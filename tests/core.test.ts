import mongoose from "mongoose";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import adminRouter from "../src/api/admin";
import submissionRouter from "../src/api/submit";
import { parseTrustProxy } from "../src/app";
import { judgeCode } from "../src/judge";
import { sanitizeProblemHtml } from "../src/lib/sanitize";
import { createToken, hashToken } from "../src/lib/tokens";
import { ClassClub, Contest, ContestAttempt, Problem, ProblemTestcase, Submission, User } from "../src/models";
import { deleteClubForUser, getClubRole } from "../src/services/clubs";
import { getContestStorageId } from "../src/services/contest-scope";
import { canAccessContest, getContestState, getScoreboard, saveContestWithProblems, startPersonalContest } from "../src/services/contests";
import { dropLegacyContestProblemIndexes, migrateDatabase, migrateLegacyUserSubmissions } from "../src/services/database-migration";
import {
    dropLegacyGlobalProblemIdIndex,
    dropLegacyProblemTestcaseIndexes,
    getContestProblem,
    getContestProblems,
    getProblemWithTestcases,
    migrateLegacyProblemTestcases,
    saveProblemWithTestcases,
} from "../src/services/problems";
import { getLatestSubmission } from "../src/services/submissions";
import { IContest, IProblemWithTestcases } from "../src/types/models";

const mongoUri = process.env.TEST_MONGO_URI ?? "mongodb://127.0.0.1:27017/levis_judex_test";

before(async () => {
    await mongoose.connect(mongoUri);
    await dropLegacyGlobalProblemIdIndex();
    await dropLegacyContestProblemIndexes();
    await dropLegacyProblemTestcaseIndexes();
});

beforeEach(async () => {
    await Promise.all([
        Contest.deleteMany({}),
        ContestAttempt.deleteMany({}),
        ClassClub.deleteMany({}),
        Problem.deleteMany({}),
        ProblemTestcase.deleteMany({}),
        Submission.deleteMany({}),
        User.deleteMany({}),
    ]);
});

after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

void test("problem html sanitizer removes executable content while preserving formatting", () => {
    const sanitized = sanitizeProblemHtml('<h2>Title</h2><img src=x onerror="alert(1)"><script>alert(2)</script><p>Body</p>');

    assert.match(sanitized, /<h2>Title<\/h2>/);
    assert.match(sanitized, /<p>Body<\/p>/);
    assert.doesNotMatch(sanitized, /script/i);
    assert.doesNotMatch(sanitized, /onerror/i);
});

void test("reset tokens are hashable without storing the raw token", () => {
    const token = createToken();
    const tokenHash = hashToken(token);

    assert.notEqual(tokenHash, token);
    assert.equal(hashToken(token), tokenHash);
    assert.equal(tokenHash.length, 64);
});

void test("delete-problem route includes authentication and admin authorization", () => {
    const layer = findRoute(adminRouter.stack, "/delete-problem", "delete");

    assert.ok(layer?.route);
    assert.deepEqual(
        layer.route.stack.map((item) => item.handle.name),
        ["authenticateToken", "requireAdmin", ""],
    );
});

void test("submission status route requires authentication", () => {
    const layer = findRoute(submissionRouter.stack, "/sub-status", "get");

    assert.ok(layer?.route);
    assert.equal(layer.route.stack[0].handle.name, "authenticateToken");
});

void test("oversized submissions fail without needing an isolate box", async () => {
    const problem: IProblemWithTestcases = {
        id: "oversized",
        inputFormat: "",
        inputTestcases: [""],
        name: "Oversized",
        numSampleTestcases: 0,
        outputFormat: "",
        outputTestcases: [""],
        problemStatement: "",
    };

    const result = await judgeCode("x".repeat(100001), problem);

    assert.deepEqual(result, [{ mem: "0 MB", status: "RTE", time: "0s" }]);
});

void test("problem save splits public metadata from judge-only testcase documents", async () => {
    await saveProblemWithTestcases(makeProblem("split", ["sample in", "hidden in"], ["sample out", "hidden out"], 1));

    const storedProblem = await Problem.findOne({ id: "split" }).lean<Record<string, unknown>>();
    assert.ok(storedProblem);
    assert.equal(storedProblem.inputTestcases, undefined);
    assert.equal(storedProblem.outputTestcases, undefined);

    const storedTestcases = await ProblemTestcase.find({ problemId: "split" }).sort({ order: 1 }).lean();
    assert.equal(storedTestcases.length, 2);
    assert.deepEqual(
        storedTestcases.map((testcase) => testcase.isSample),
        [true, false],
    );
});

void test("legacy problem testcase migration moves embedded arrays into testcase documents", async () => {
    await Problem.collection.insertOne({
        id: "legacy-split",
        inputFormat: "Input",
        inputTestcases: ["sample in", "hidden in"],
        isPrivate: false,
        name: "legacy-split",
        numSampleTestcases: 1,
        outputFormat: "Output",
        outputTestcases: ["sample out", "hidden out"],
        problemStatement: "Statement",
        whitelist: [],
    });

    const migrated = await migrateLegacyProblemTestcases();
    const storedProblem = await Problem.findOne({ id: "legacy-split" }).lean<Record<string, unknown>>();
    const storedTestcases = await ProblemTestcase.find({ problemId: "legacy-split" }).sort({ order: 1 }).lean();

    assert.equal(migrated, 1);
    assert.ok(storedProblem);
    assert.equal(storedProblem.inputTestcases, undefined);
    assert.equal(storedProblem.outputTestcases, undefined);
    assert.deepEqual(
        storedTestcases.map((testcase) => testcase.input),
        ["sample in", "hidden in"],
    );
});

void test("database migration normalizes legacy contests and user submission maps idempotently", async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
        _id: userId,
        code: {
            "legacy-contest:legacy-problem": "print('contest')",
            standalone: "print('standalone')",
        },
        email: "legacy@example.com",
        password: "hash",
        results: {
            "legacy-contest:legacy-problem": [{ mem: "2 MB", status: "AC", time: "0.2s" }],
            standalone: [{ mem: "1 MB", status: "WA", time: "0.1s" }],
        },
        verified: true,
    });
    await Contest.collection.insertOne({
        endTime: new Date(Date.now() + 60_000),
        id: "legacy-contest",
        name: "Legacy Contest",
        problems: [makeProblem("legacy-problem", ["sample in", "hidden in"], ["sample out", "hidden out"], 1)],
        startTime: new Date(Date.now() - 60_000),
    });

    const firstRun = await migrateDatabase();
    const secondRun = await migrateDatabase();
    const migratedContest = await Contest.findOne({ id: "legacy-contest" }).lean<Record<string, unknown>>();
    const migratedProblem = await getProblemWithTestcases("legacy-problem", true, "legacy-contest");
    const submissions = await Submission.find({ userId }).sort({ problemId: 1 }).lean();
    const migratedUser = await User.collection.findOne({ _id: userId });

    assert.equal(firstRun.contests.migrated, 1);
    assert.equal(firstRun.contests.importedProblems, 1);
    assert.equal(firstRun.submissions.migrated, 2);
    assert.equal(secondRun.contests.migrated, 0);
    assert.equal(secondRun.submissions.migrated, 0);
    assert.ok(migratedContest);
    assert.deepEqual(migratedContest.problemIds, ["legacy-problem"]);
    assert.deepEqual(migratedContest.problemPoints, { "legacy-problem": 100 });
    assert.equal(migratedContest.problems, undefined);
    assert.ok(migratedProblem);
    assert.deepEqual(migratedProblem.inputTestcases, ["sample in", "hidden in"]);
    assert.equal(submissions.length, 2);
    assert.deepEqual(
        submissions.map((submission) => `${submission.contestId ?? ""}:${submission.problemId}:${submission.results[0].status}`),
        ["legacy-contest:legacy-problem:AC", ":standalone:WA"],
    );
    assert.equal(migratedUser?.code, undefined);
    assert.equal(migratedUser?.results, undefined);
});

void test("legacy user submission migration can handle code-only maps", async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
        _id: userId,
        code: { onlycode: "print(123)" },
        email: "code-only@example.com",
        password: "hash",
        verified: true,
    });

    const migrated = await migrateLegacyUserSubmissions();
    const submission = await Submission.findOne({ problemId: "onlycode", userId }).lean();

    assert.equal(migrated, 1);
    assert.ok(submission);
    assert.equal(submission.code, "print(123)");
    assert.deepEqual(submission.results, []);
});

void test("public problem reads include only sample testcases", async () => {
    await saveProblemWithTestcases(makeProblem("sample-only", ["sample in", "hidden in"], ["sample out", "hidden out"], 1));

    const publicProblem = await getProblemWithTestcases("sample-only", false);
    const judgeProblem = await getProblemWithTestcases("sample-only", true);

    assert.ok(publicProblem);
    assert.ok(judgeProblem);
    assert.deepEqual(publicProblem.inputTestcases, ["sample in"]);
    assert.deepEqual(publicProblem.outputTestcases, ["sample out"]);
    assert.deepEqual(judgeProblem.inputTestcases, ["sample in", "hidden in"]);
    assert.deepEqual(judgeProblem.outputTestcases, ["sample out", "hidden out"]);
});

void test("contests resolve normalized problem ids while tolerating legacy embedded problems", async () => {
    await saveProblemWithTestcases(makeProblem("a", ["1", "2"], ["1", "2"], 1));
    const contest = await Contest.create({
        endTime: new Date(Date.now() + 60_000),
        id: "contest",
        name: "Contest",
        problemIds: ["a"],
        startTime: new Date(Date.now() - 60_000),
    });

    const normalizedProblems = await getContestProblems(contest.toObject<IContest>(), false);
    assert.deepEqual(
        normalizedProblems.map((problem) => problem.id),
        ["a"],
    );
    assert.deepEqual(normalizedProblems[0].inputTestcases, ["1"]);

    const legacyContest: IContest = {
        endTime: new Date(Date.now() + 60_000),
        id: "legacy",
        name: "Legacy",
        problemIds: [],
        problems: [makeProblem("legacy-a", ["sample", "hidden"], ["sample", "hidden"], 1)],
        startTime: new Date(Date.now() - 60_000),
    };

    const legacyProblem = await getContestProblem(legacyContest, "legacy-a", false);
    assert.ok(legacyProblem);
    assert.deepEqual(legacyProblem.inputTestcases, ["sample"]);
});

void test("latest code and result reads come from submissions collection", async () => {
    const user = await User.create({ email: "user@example.com", password: "hash", verified: true });
    await Submission.create({
        code: "print('old')",
        completedAt: new Date("2025-01-01T00:00:00Z"),
        problemId: "submissions",
        results: [{ mem: "1 MB", status: "WA", time: "0.1s" }],
        status: "completed",
        userId: user._id,
    });
    await Submission.create({
        code: "print('new')",
        completedAt: new Date("2025-01-02T00:00:00Z"),
        problemId: "submissions",
        results: [{ mem: "1 MB", status: "AC", time: "0.1s" }],
        status: "completed",
        userId: user._id,
    });

    const latest = await getLatestSubmission(user._id, "submissions", null);
    assert.ok(latest);
    assert.equal(latest.code, "print('new')");
    assert.equal(latest.results[0].status, "AC");
});

void test("personal contest timers unlock scoring only after user start", async () => {
    const user = await User.create({ email: "timer@example.com", password: "hash", verified: true });
    const contest = await Contest.create({
        durationMinutes: 240,
        endTime: new Date("2026-01-03T00:00:00Z"),
        id: "timer",
        name: "Timer Contest",
        problemIds: [],
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "personal",
    });

    const beforeStart = await getContestState(contest, user._id, new Date("2025-12-31T23:00:00Z"));
    const beforeAttempt = await getContestState(contest, user._id, new Date("2026-01-01T01:00:00Z"));
    const attempt = await startPersonalContest(contest, user._id, new Date("2026-01-01T02:00:00Z"));
    const duringAttempt = await getContestState(contest, user._id, new Date("2026-01-01T03:00:00Z"));
    const afterAttempt = await getContestState(contest, user._id, new Date("2026-01-01T07:00:00Z"));

    assert.equal(beforeStart.status, "not-started");
    assert.equal(beforeAttempt.canStart, true);
    assert.equal(beforeAttempt.canViewProblems, false);
    assert.equal(attempt.endsAt.toISOString(), "2026-01-01T06:00:00.000Z");
    assert.equal(duringAttempt.canSubmitForScore, true);
    assert.equal(duringAttempt.canViewProblems, true);
    assert.equal(afterAttempt.canSubmitForScore, false);
    assert.equal(afterAttempt.canViewProblems, true);
});

void test("global contest state allows archive submissions without score", async () => {
    const contest: IContest = {
        endTime: new Date("2026-01-01T06:00:00Z"),
        id: "global",
        name: "Global Contest",
        problemIds: ["g"],
        startTime: new Date("2026-01-01T02:00:00Z"),
        timingMode: "global",
    };

    const before = await getContestState(contest, undefined, new Date("2026-01-01T01:00:00Z"));
    const active = await getContestState(contest, undefined, new Date("2026-01-01T03:00:00Z"));
    const closed = await getContestState(contest, undefined, new Date("2026-01-01T07:00:00Z"));

    assert.equal(before.canViewProblems, false);
    assert.equal(active.canSubmitForScore, true);
    assert.equal(closed.canViewProblems, true);
    assert.equal(closed.canSubmitForScore, false);
});

void test("contest save supports existing and inline-created problems", async () => {
    await saveProblemWithTestcases(makeProblem("existing", ["1"], ["1"], 1));

    const contest = await saveContestWithProblems({
        durationMinutes: 180,
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: ["existing"],
        id: "creator",
        inlineProblems: [makeProblem("inline", ["sample", "hidden"], ["sample", "hidden"], 1)],
        name: "Creator Contest",
        problemPoints: { existing: 75, inline: 125 },
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "personal",
    });
    const inlineProblem = await getProblemWithTestcases("inline", true, "creator");
    const savedContest = await Contest.findOne({ id: "creator" }).lean<IContest>();

    assert.deepEqual(contest.problemIds, ["existing", "inline"]);
    assert.equal(contest.durationMinutes, 180);
    assert.deepEqual(savedContest?.problemPoints, { existing: 75, inline: 125 });
    assert.ok(inlineProblem);
    assert.equal(inlineProblem.contestID, "creator");
    assert.deepEqual(inlineProblem.inputTestcases, ["sample", "hidden"]);
});

void test("restricted contests are available only to class or club members and admins", async () => {
    const member = await User.create({ email: "member@example.com", password: "hash", verified: true });
    const outsider = await User.create({ email: "outsider@example.com", password: "hash", verified: true });
    const admin = await User.create({ admin: true, email: "admin@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "club",
        memberEmails: ["member@example.com"],
        name: "Club",
        ownerId: admin._id,
    });

    const contest = await saveContestWithProblems({
        accessType: "club",
        clubId: "club",
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "restricted",
        inlineProblems: [makeProblem("a", ["sample", "hidden"], ["sample", "hidden"], 1)],
        name: "Restricted Contest",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    assert.equal(await canAccessContest(contest, member._id), true);
    assert.equal(await canAccessContest(contest, outsider._id), false);
    assert.equal(await canAccessContest(contest, admin._id), true);
    assert.equal(await canAccessContest(contest), false);
});

void test("club roles distinguish pending invites and join requests", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    const invited = await User.create({ email: "invited@example.com", password: "hash", verified: true });
    const requested = await User.create({ email: "requested@example.com", password: "hash", verified: true });
    const member = await User.create({ email: "member@example.com", password: "hash", verified: true });
    const visitor = await User.create({ email: "visitor@example.com", password: "hash", verified: true });
    const club = await ClassClub.create({
        id: "roles",
        inviteEmails: ["invited@example.com"],
        memberEmails: ["member@example.com"],
        name: "Roles",
        ownerId: owner._id,
        requestEmails: ["requested@example.com"],
    });

    assert.equal(await getClubRole(club, owner._id), "owner");
    assert.equal(await getClubRole(club, member._id), "member");
    assert.equal(await getClubRole(club, invited._id), "invited");
    assert.equal(await getClubRole(club, requested._id), "requested");
    assert.equal(await getClubRole(club, visitor._id), "visitor");
});

void test("club owners can delete empty clubs but outsiders cannot", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    const outsider = await User.create({ email: "outsider@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "delete-me",
        memberEmails: [],
        name: "Delete Me",
        ownerId: owner._id,
    });

    await assert.rejects(() => deleteClubForUser("delete-me", outsider._id), /Only the club owner/);
    await deleteClubForUser("delete-me", owner._id);

    assert.equal(await ClassClub.exists({ id: "delete-me" }), null);
});

void test("clubs with contests cannot be deleted until contests are moved or removed", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "contest-club",
        memberEmails: [],
        name: "Contest Club",
        ownerId: owner._id,
    });
    await Contest.create({
        accessType: "club",
        clubId: "contest-club",
        endTime: new Date("2026-01-02T00:00:00Z"),
        id: "club-contest",
        name: "Club Contest",
        problemIds: [],
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    await assert.rejects(() => deleteClubForUser("contest-club", owner._id), /This club has contests/);
    assert.ok(await ClassClub.exists({ id: "contest-club" }));
});

void test("open club contests are visible to signed-in users without a manual invite", async () => {
    const visitor = await User.create({ email: "visitor@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "open-club",
        joinPolicy: "open",
        memberEmails: [],
        name: "Open Club",
    });

    const contest = await saveContestWithProblems({
        accessType: "club",
        clubId: "open-club",
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "open-club-contest",
        inlineProblems: [makeProblem("a", ["sample", "hidden"], ["sample", "hidden"], 1)],
        name: "Open Club Contest",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    assert.equal(await canAccessContest(contest, visitor._id), true);
    assert.equal(await canAccessContest(contest), false);
});

void test("different contests can have different problems with the same local id", async () => {
    await saveContestWithProblems({
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "contest-a",
        inlineProblems: [{ ...makeProblem("1", ["a sample", "a hidden"], ["a sample", "a hidden"], 1), problemStatement: "Contest A problem" }],
        name: "Contest A",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });
    await saveContestWithProblems({
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "contest-b",
        inlineProblems: [{ ...makeProblem("1", ["b sample"], ["b sample"], 1), problemStatement: "Contest B problem" }],
        name: "Contest B",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    const contestA = await Contest.findOne({ id: "contest-a" }).lean<IContest>();
    const contestB = await Contest.findOne({ id: "contest-b" }).lean<IContest>();
    assert.ok(contestA);
    assert.ok(contestB);

    const problemA = await getContestProblem(contestA, "1", true);
    const problemB = await getContestProblem(contestB, "1", true);
    const globalProblem = await getProblemWithTestcases("1", true);

    assert.ok(problemA);
    assert.ok(problemB);
    assert.equal(globalProblem, null);
    assert.equal(problemA.problemStatement, "Contest A problem");
    assert.equal(problemB.problemStatement, "Contest B problem");
    assert.deepEqual(problemA.inputTestcases, ["a sample", "a hidden"]);
    assert.deepEqual(problemB.inputTestcases, ["b sample"]);
});

void test("club contest ids are scoped and do not overwrite public contests", async () => {
    await ClassClub.create({ id: "alpha", memberEmails: [], name: "Alpha" });
    await ClassClub.create({ id: "beta", memberEmails: [], name: "Beta" });
    await saveProblemWithTestcases(makeProblem("bank", ["sample"], ["sample"], 1));
    await saveContestWithProblems({
        accessType: "public",
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: ["bank"],
        id: "week1",
        inlineProblems: [],
        name: "Public Week 1",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });
    const alpha = await saveContestWithProblems({
        accessType: "club",
        clubId: "alpha",
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "week1",
        inlineProblems: [makeProblem("1", ["alpha"], ["alpha"], 1)],
        name: "Alpha Week 1",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });
    const beta = await saveContestWithProblems({
        accessType: "club",
        clubId: "beta",
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "week1",
        inlineProblems: [makeProblem("1", ["beta"], ["beta"], 1)],
        name: "Beta Week 1",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    const contests = await Contest.find({ id: "week1" }).sort({ clubId: 1 }).lean<IContest[]>();
    const publicContest = await Contest.findOne({ clubId: null, id: "week1" }).lean<IContest>();
    const alphaProblem = await getProblemWithTestcases("1", true, getContestStorageId(alpha));
    const betaProblem = await getProblemWithTestcases("1", true, getContestStorageId(beta));

    assert.equal(contests.length, 3);
    assert.equal(publicContest?.name, "Public Week 1");
    assert.equal(alpha.name, "Alpha Week 1");
    assert.equal(beta.name, "Beta Week 1");
    assert.deepEqual(alphaProblem?.inputTestcases, ["alpha"]);
    assert.deepEqual(betaProblem?.inputTestcases, ["beta"]);
});

void test("legacy testcase uniqueness index is removed before saving scoped duplicate problem ids", async () => {
    await ProblemTestcase.collection.createIndex({ order: 1, problemId: 1 }, { name: "order_1_problemId_1", unique: true });
    const dropped = await dropLegacyProblemTestcaseIndexes();

    await saveProblemWithTestcases(makeProblem("1", ["global"], ["global"], 1));
    await saveContestWithProblems({
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "scoped-index",
        inlineProblems: [makeProblem("1", ["scoped"], ["scoped"], 1)],
        name: "Scoped Index",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    const scopedProblem = await getProblemWithTestcases("1", true, "scoped-index");

    assert.equal(dropped, 1);
    assert.ok(scopedProblem);
    assert.deepEqual(scopedProblem.inputTestcases, ["scoped"]);
});

void test("legacy contest embedded-problem index is removed before saving normalized contests", async () => {
    await Contest.collection.createIndex({ "problems.id": 1 }, { name: "problems.id_1", unique: true });
    await Contest.create({
        endTime: new Date("2026-01-05T00:00:00Z"),
        id: "existing-normalized",
        name: "Existing Normalized",
        problemIds: [],
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    await assert.rejects(
        () =>
            saveContestWithProblems({
                endTime: new Date("2026-01-05T00:00:00Z"),
                existingProblemIds: [],
                id: "blocked-by-legacy-index",
                inlineProblems: [makeProblem("1", ["scoped"], ["scoped"], 1)],
                name: "Blocked By Legacy Index",
                startTime: new Date("2026-01-01T00:00:00Z"),
                timingMode: "global",
            }),
        /duplicate key/,
    );

    const dropped = await dropLegacyContestProblemIndexes();
    const contest = await saveContestWithProblems({
        endTime: new Date("2026-01-05T00:00:00Z"),
        existingProblemIds: [],
        id: "blocked-by-legacy-index",
        inlineProblems: [makeProblem("1", ["scoped"], ["scoped"], 1)],
        name: "Blocked By Legacy Index",
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    assert.equal(dropped, 1);
    assert.deepEqual(contest.problemIds, ["1"]);
});

void test("scoreboard counts only scored contest submissions", async () => {
    const user = await User.create({ email: "score@example.com", password: "hash", verified: true });
    await Submission.create({
        code: "print('bad')",
        completedAt: new Date("2026-01-01T01:00:00Z"),
        contestId: "scores",
        contestScored: false,
        problemId: "a",
        results: [{ mem: "1 MB", status: "AC", time: "0.1s" }],
        status: "completed",
        userId: user._id,
    });
    await Contest.create({
        endTime: new Date("2026-01-01T04:00:00Z"),
        id: "scores",
        name: "Scores",
        problemIds: ["a", "b"],
        problemPoints: { a: 250, b: 40 },
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });
    await Submission.create({
        code: "print('partial')",
        completedAt: new Date("2026-01-01T02:00:00Z"),
        contestId: "scores",
        contestScored: true,
        problemId: "a",
        results: [
            { mem: "1 MB", status: "AC", time: "0.1s" },
            { mem: "1 MB", status: "WA", time: "0.1s" },
        ],
        status: "completed",
        userId: user._id,
    });
    await Submission.create({
        code: "print('good')",
        completedAt: new Date("2026-01-01T03:00:00Z"),
        contestId: "scores",
        contestScored: true,
        problemId: "a",
        results: [
            { mem: "1 MB", status: "AC", time: "0.1s" },
            { mem: "1 MB", status: "AC", time: "0.1s" },
        ],
        status: "completed",
        userId: user._id,
    });
    await Submission.create({
        code: "print('partial-b')",
        completedAt: new Date("2026-01-01T03:30:00Z"),
        contestId: "scores",
        contestScored: true,
        problemId: "b",
        results: [
            { mem: "1 MB", status: "AC", time: "0.1s" },
            { mem: "1 MB", status: "WA", time: "0.1s" },
        ],
        status: "completed",
        userId: user._id,
    });

    const scoreboard = await getScoreboard("scores");

    assert.equal(scoreboard.length, 1);
    assert.equal(scoreboard[0].email, "score@example.com");
    assert.equal(scoreboard[0].points, 270);
    assert.equal(scoreboard[0].solved, 1);
});

void test("scoreboard ranks by points before solved count", async () => {
    const partial = await User.create({ email: "partial@example.com", password: "hash", verified: true });
    const solved = await User.create({ email: "solved@example.com", password: "hash", verified: true });
    await Contest.create({
        endTime: new Date("2026-01-01T04:00:00Z"),
        id: "points-rank",
        name: "Points Rank",
        problemIds: ["big", "small"],
        problemPoints: { big: 100, small: 10 },
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });
    await Submission.create({
        code: "print('partial')",
        completedAt: new Date("2026-01-01T00:30:00Z"),
        contestId: "points-rank",
        contestScored: true,
        problemId: "big",
        results: [
            { mem: "1 MB", status: "AC", time: "0.1s" },
            { mem: "1 MB", status: "WA", time: "0.1s" },
        ],
        status: "completed",
        userId: partial._id,
    });
    await Submission.create({
        code: "print('solved')",
        completedAt: new Date("2026-01-01T00:10:00Z"),
        contestId: "points-rank",
        contestScored: true,
        problemId: "small",
        results: [{ mem: "1 MB", status: "AC", time: "0.1s" }],
        status: "completed",
        userId: solved._id,
    });

    const scoreboard = await getScoreboard("points-rank");

    assert.deepEqual(
        scoreboard.map((row) => row.email),
        ["partial@example.com", "solved@example.com"],
    );
    assert.deepEqual(
        scoreboard.map((row) => row.points),
        [50, 10],
    );
    assert.deepEqual(
        scoreboard.map((row) => row.solved),
        [0, 1],
    );
});

void test("scoreboard ignores sample tests and breaks ties by elapsed contest time", async () => {
    const fast = await User.create({ email: "fast@example.com", password: "hash", verified: true });
    const slow = await User.create({ email: "slow@example.com", password: "hash", verified: true });
    await saveProblemWithTestcases(makeProblem("usaco", ["sample", "hidden-a", "hidden-b"], ["sample", "hidden-a", "hidden-b"], 1));
    await Contest.create({
        endTime: new Date("2026-01-01T04:00:00Z"),
        id: "usaco-score",
        name: "USACO Score",
        problemIds: ["usaco"],
        problemPoints: { usaco: 100 },
        startTime: new Date("2026-01-01T00:00:00Z"),
        timingMode: "global",
    });

    for (const [user, completedAt] of [
        [fast, new Date("2026-01-01T00:10:00Z")],
        [slow, new Date("2026-01-01T00:20:00Z")],
    ] as const) {
        await Submission.create({
            code: "print('partial')",
            completedAt,
            contestId: "usaco-score",
            contestScored: true,
            problemId: "usaco",
            results: [
                { mem: "1 MB", status: "WA", time: "0.1s" },
                { mem: "1 MB", status: "AC", time: "0.1s" },
                { mem: "1 MB", status: "WA", time: "0.1s" },
            ],
            status: "completed",
            userId: user._id,
        });
    }

    const scoreboard = await getScoreboard("usaco-score");

    assert.deepEqual(
        scoreboard.map((row) => row.email),
        ["fast@example.com", "slow@example.com"],
    );
    assert.deepEqual(
        scoreboard.map((row) => row.points),
        [50, 50],
    );
    assert.deepEqual(
        scoreboard.map((row) => row.elapsedMs),
        [10 * 60 * 1000, 20 * 60 * 1000],
    );
});

void test("trust proxy parser keeps explicit false and numeric settings", () => {
    assert.equal(parseTrustProxy(undefined), true);
    assert.equal(parseTrustProxy("false"), false);
    assert.equal(parseTrustProxy("2"), 2);
});

interface RouteLayer {
    route?: {
        methods: Record<string, boolean>;
        path: string;
        stack: { handle: { name: string } }[];
    };
}

function findRoute(stack: RouteLayer[], path: string, method: string): RouteLayer | undefined {
    return stack.find((item) => item.route?.path === path && item.route.methods[method]);
}

function makeProblem(id: string, inputTestcases: string[], outputTestcases: string[], numSampleTestcases: number): IProblemWithTestcases {
    return {
        id,
        inputFormat: "Input",
        inputTestcases,
        isPrivate: false,
        name: id,
        numSampleTestcases,
        outputFormat: "Output",
        outputTestcases,
        problemStatement: "Statement",
        whitelist: [],
    };
}
