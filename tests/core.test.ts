import mongoose from "mongoose";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";

import adminRouter from "../src/api/admin";
import submissionRouter from "../src/api/submit";
import { parseTrustProxy } from "../src/app";
import { judgeCode } from "../src/judge";
import { sanitizeProblemHtml } from "../src/lib/sanitize";
import { createToken, hashToken } from "../src/lib/tokens";
import { Contest, Problem, ProblemTestcase, Submission, User } from "../src/models";
import { migrateDatabase, migrateLegacyUserSubmissions } from "../src/services/database-migration";
import {
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
});

beforeEach(async () => {
    await Promise.all([
        Contest.deleteMany({}),
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
    const migratedProblem = await getProblemWithTestcases("legacy-problem", true);
    const submissions = await Submission.find({ userId }).sort({ problemId: 1 }).lean();
    const migratedUser = await User.collection.findOne({ _id: userId });

    assert.equal(firstRun.contests.migrated, 1);
    assert.equal(firstRun.contests.importedProblems, 1);
    assert.equal(firstRun.submissions.migrated, 2);
    assert.equal(secondRun.contests.migrated, 0);
    assert.equal(secondRun.submissions.migrated, 0);
    assert.ok(migratedContest);
    assert.deepEqual(migratedContest.problemIds, ["legacy-problem"]);
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
