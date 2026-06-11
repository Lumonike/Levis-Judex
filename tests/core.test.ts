import mongoose from "mongoose";
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { after, before, beforeEach } from "node:test";

import adminRouter from "../src/api/admin";
import submissionRouter from "../src/api/submit";
import { parseTrustProxy } from "../src/app";
import { judgeCode } from "../src/judge";
import { MAX_CLUBS_PER_OWNER, MAX_CONTESTS_PER_CLUB, MAX_PROBLEMS_PER_CONTEST } from "../src/lib/limits";
import { sanitizeProblemHtml } from "../src/lib/sanitize";
import { createToken, hashToken } from "../src/lib/tokens";
import { authenticateToken } from "../src/middleware/authenticate";
import { ClassClub, Contest, ContestAttempt, Problem, ProblemTestcase, Submission, User } from "../src/models";
import clubsPageRouter from "../src/pages/clubs";
import {
    assertClubCreationLimit,
    buildClubInviteLink,
    deleteClubForUser,
    getClubRole,
    requestClubWithInviteCode,
    requireClubInviteCode,
    serializeClub,
} from "../src/services/clubs";
import { getContestStorageId } from "../src/services/contest-scope";
import { canAccessContest, getContestState, getScoreboard, saveContestWithProblems, startPersonalContest } from "../src/services/contests";
import {
    dropLegacyContestProblemIndexes,
    migrateClubRosterFields,
    migrateDatabase,
    migrateLegacyUserSubmissions,
} from "../src/services/database-migration";
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

void test("problem html sanitizer preserves KaTeX layout styles without allowing arbitrary CSS", () => {
    const sanitized = sanitizeProblemHtml(
        '<span class="__se__katex katex" contenteditable="false" data-exp="a_i" data-font-size="1em" style="font-size:1em; color:red; background-image:url(javascript:alert(1))"><span class="vlist" style="height:0.95em; top:-0.4em; margin-right:0.05em">x</span></span>',
    );

    assert.match(sanitized, /class="__se__katex katex"/);
    assert.match(sanitized, /contenteditable="false"/);
    assert.match(sanitized, /data-exp="a_i"/);
    assert.match(sanitized, /data-font-size="1em"/);
    assert.match(sanitized, /font-size:1em/);
    assert.match(sanitized, /height:0\.95em/);
    assert.match(sanitized, /top:-0\.4em/);
    assert.match(sanitized, /margin-right:0\.05em/);
    assert.doesNotMatch(sanitized, /color:red/);
    assert.doesNotMatch(sanitized, /javascript/i);
    assert.doesNotMatch(sanitized, /background-image/i);
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

void test("club detail page is authenticated without shadowing club contest creation", () => {
    const addContestLayer = findRoute(clubsPageRouter.stack, "/clubs/:clubID/add-contest", "get");
    const detailLayer = findRoute(clubsPageRouter.stack, "/clubs/:clubID", "get");

    assert.ok(addContestLayer?.route);
    assert.ok(detailLayer?.route);
    assert.ok(addContestLayer.route.stack.length >= 2);
    assert.ok(detailLayer.route.stack.length >= 2);
    assert.ok(clubsPageRouter.stack.indexOf(addContestLayer) < clubsPageRouter.stack.indexOf(detailLayer));
});

void test("top navigation uses Code Joint logo without exposing admin link", () => {
    const layout = fs.readFileSync("views/layout.ejs", "utf8");

    assert.match(layout, /https:\/\/codejoint\.org\/images\/cjcircle\.png/);
    assert.doesNotMatch(layout, /href="\/admin">Admin/);
});

void test("club management uses bounded roster lists instead of full-width member rows", () => {
    const clubsScript = fs.readFileSync("public/clubs/clubs.js", "utf8");
    const script = fs.readFileSync("public/clubs/club-detail.js", "utf8");
    const styles = fs.readFileSync("public/styles/app.css", "utf8");
    const clubsApi = fs.readFileSync("src/api/clubs.ts", "utf8");

    assert.match(clubsScript, /mode:\s*"create"/);
    assert.match(clubsApi, /existing && req\.body\.mode === "create"/);
    assert.match(clubsApi, /A club with that ID already exists/);
    assert.match(script, /club-management-layout/);
    assert.match(script, /club-management-side/);
    assert.ok(script.indexOf("club-code-row") < script.indexOf("rename-club-form"));
    assert.match(script, /mode:\s*"update"/);
    assert.match(script, /data-role="invite-email"/);
    assert.match(script, /\{\s*email:\s*document\.querySelector\("\[data-role='invite-email'\]"\)\.value\s*\}/);
    assert.match(script, /club-roster-list/);
    assert.match(script, /club-roster-dialog/);
    assert.match(styles, /\.club-modal\s*{/);
    assert.match(styles, /\.club-management-layout\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*12\.5rem/s);
    assert.match(styles, /\.club-management-side\s*{[^}]*padding-top:\s*1\.25rem/s);
    assert.match(styles, /#main-section button\.club-roster-summary:not\(\.se-btn\)\s*{[^}]*display:\s*grid/s);
    assert.match(styles, /#main-section button\.club-roster-summary:not\(\.se-btn\)\s*{[^}]*grid-template-columns:\s*8rem\s*2\.25rem/s);
    assert.match(styles, /#main-section button\.club-roster-summary:not\(\.se-btn\)\s*{[^}]*justify-content:\s*center/s);
    assert.match(styles, /\.club-roster-summary \.badge\s*{[^}]*justify-self:\s*end/s);
    assert.match(styles, /\.club-roster-summary \.badge\s*{[^}]*width:\s*2rem/s);
    assert.match(styles, /\.club-control-row\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/s);
    assert.match(styles, /\.club-code-row\s*{[^}]*grid-template-columns:\s*minmax\(9rem,\s*12rem\)\s*auto\s*auto/s);
    assert.match(styles, /\.problem-page #result:empty \+ \.problem-section\s*{[^}]*margin-top:\s*0/s);
    assert.match(clubsApi, /normalizeEmailList\(req\.body\.email \? \[req\.body\.email\] : req\.body\.emails\)/);
});

void test("shared page chrome keeps back links and contest timing compact", () => {
    const contestView = fs.readFileSync("views/contest.ejs", "utf8");
    const contestsView = fs.readFileSync("views/contests.ejs", "utf8");
    const contestsPage = fs.readFileSync("src/pages/contests.ts", "utf8");
    const backPartial = fs.readFileSync("views/partials/back-arrow.ejs", "utf8");
    const styles = fs.readFileSync("public/styles/app.css", "utf8");

    assert.match(backPartial, /class="btn btn-secondary back-link"/);
    assert.match(styles, /\.back-link\.btn\s*{[^}]*min-height:\s*2rem/s);
    assert.match(styles, /\.back-link\.btn\s*{[^}]*padding:\s*0\.3rem 0\.45rem 0\.3rem 0/s);
    assert.match(styles, /\.back-link\.btn:hover\s*{[^}]*border-color:\s*transparent/s);
    assert.match(styles, /\.back-link\.btn:hover\s*{[^}]*background:\s*transparent/s);
    assert.match(contestView, /page-header contest-header/);
    assert.match(contestView, /Club contest.*contest\.clubName/s);
    assert.match(contestsView, /Club: \$\{contest\.clubName \?\? contest\.clubId\}/);
    assert.match(contestsPage, /ClassClub\.find/);
    assert.match(contestView, /contest-timing-panel/);
    assert.match(styles, /\.contest-header\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*max-content/s);
    assert.match(styles, /\.panel-body\.contest-timing-panel\s*{[^}]*justify-self:\s*end/s);
    assert.match(styles, /\.panel-body\.contest-timing-panel\s*{[^}]*padding:\s*0 1rem 0\.55rem/s);
    assert.match(styles, /\.panel-body\.contest-timing-panel\s*{[^}]*text-align:\s*right/s);
    assert.match(styles, /\.contest-timing-panel \.section-note\s*{[^}]*margin:\s*0 0 0\.35rem/s);
});

void test("contest editor exposes visible remove controls and direct edit links", () => {
    const editorScript = fs.readFileSync("public/admin/add-contest/add-contest.js", "utf8");
    const clubDetailScript = fs.readFileSync("public/clubs/club-detail.js", "utf8");
    const clubPages = fs.readFileSync("src/pages/clubs.ts", "utf8");
    const adminPages = fs.readFileSync("src/pages/admin.ts", "utf8");
    const contestView = fs.readFileSync("views/contest.ejs", "utf8");
    const contestPages = fs.readFileSync("src/pages/contests.ts", "utf8");

    assert.match(editorScript, /class="btn btn-danger"/);
    assert.match(editorScript, /editorConfig\.initialContestId/);
    assert.match(clubDetailScript, /\/contests\/\$\{encodeURIComponent\(contest\.id\)\}\/edit/);
    assert.match(clubPages, /\/clubs\/:clubID\/contests\/:contestID\/edit/);
    assert.match(adminPages, /initialContestId/);
    assert.match(contestView, /Edit Contest/);
    assert.match(contestPages, /editHref/);
});

void test("problem editors preserve SunEditor KaTeX metadata on reload", () => {
    const problemEditorScript = fs.readFileSync("public/admin/add-problem/add-problem.js", "utf8");
    const contestEditorScript = fs.readFileSync("public/admin/add-contest/add-contest.js", "utf8");
    const editorStyles = fs.readFileSync("public/admin/add-problem/sun-editor.css", "utf8");
    const appStyles = fs.readFileSync("public/styles/app.css", "utf8");

    assert.match(problemEditorScript, /attributesWhitelist:\s*{[^}]*span:\s*"style\|contenteditable\|data-exp\|data-font-size"/s);
    assert.match(contestEditorScript, /attributesWhitelist:\s*{[^}]*span:\s*"style\|contenteditable\|data-exp\|data-font-size"/s);
    assert.match(editorStyles, /\.sun-editor-editable \.__se__katex\.katex\s*{[^}]*font-size:\s*1em/s);
    assert.match(appStyles, /\.problem-section \.__se__katex\.katex\s*{[^}]*font-size:\s*1em/s);
});

void test("problem result tiles use centered seven-column wrapping", () => {
    const problemStyles = fs.readFileSync("public/problems/problem-style.css", "utf8");

    assert.match(problemStyles, /\.box-container\s*{[^}]*justify-content:\s*center/s);
    assert.match(problemStyles, /\.box-container\s*{[^}]*width:\s*fit-content/s);
    assert.match(problemStyles, /\.box-container\s*{[^}]*max-width:\s*min\(100%,\s*662px\)/s);
    assert.match(problemStyles, /\.modern-box\s*{[^}]*width:\s*86px/s);
    assert.match(problemStyles, /\.modern-box\s*{[^}]*height:\s*72px/s);
    assert.match(problemStyles, /\.metric-text\s*{[^}]*white-space:\s*nowrap/s);
    assert.match(problemStyles, /\.status-symbol svg\s*{[^}]*width:\s*26px/s);
});

void test("problem and contest lists use ordinal pills while keeping ids as metadata", () => {
    const problemList = fs.readFileSync("views/problems.ejs", "utf8");
    const contestList = fs.readFileSync("views/contests.ejs", "utf8");
    const contestView = fs.readFileSync("views/contest.ejs", "utf8");
    const clubDetailScript = fs.readFileSync("public/clubs/club-detail.js", "utf8");

    assert.match(problemList, /problems\.forEach\(\(problem,\s*index\)/);
    assert.match(problemList, /<span class="id-pill"><%= index \+ 1 %><\/span>/);
    assert.match(problemList, /ID: <%= problem\.id %>/);
    assert.match(contestList, /contests\.forEach\(\(contest,\s*index\)/);
    assert.match(contestList, /<span class="id-pill"><%= index \+ 1 %><\/span>/);
    assert.match(contestList, /ID: <%= contest\.id %>/);
    assert.match(contestView, /contest\.problems\.forEach\(\(problem,\s*index\)/);
    assert.match(contestView, /ID: <%= problem\.id %> · <%= problem\.points %> points/);
    assert.match(clubDetailScript, /\(contest,\s*index\) =>/);
    assert.match(clubDetailScript, /ID: \$\{escapeText\(contest\.id\)\}/);
});

void test("page requests with missing auth redirect to login instead of returning raw JSON", () => {
    let clearedCookie = "";
    let redirectUrl = "";

    const req = {
        cookies: {},
        headers: { accept: "text/html" },
        originalUrl: "/clubs",
        path: "/clubs",
        url: "/clubs",
    };
    const res = {
        clearCookie(name: string) {
            clearedCookie = name;
            return this;
        },
        redirect(url: string) {
            redirectUrl = url;
            return this;
        },
        status() {
            throw new Error("Page auth failures should redirect.");
        },
    };

    authenticateToken(req as never, res as never, () => {
        throw new Error("Unauthenticated requests should not continue.");
    });

    assert.equal(clearedCookie, "authToken");
    assert.equal(redirectUrl, "/login?next=%2Fclubs");
});

void test("api requests with missing auth still return a concise JSON error", () => {
    let statusCode = 0;
    let payload: unknown;

    const req = {
        cookies: {},
        headers: { accept: "application/json" },
        originalUrl: "/api/clubs/mine",
        path: "/api/clubs/mine",
        url: "/api/clubs/mine",
    };
    const res = {
        json(body: unknown) {
            payload = body;
            return this;
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
    };

    authenticateToken(req as never, res as never, () => {
        throw new Error("Unauthenticated requests should not continue.");
    });

    assert.equal(statusCode, 403);
    assert.deepEqual(payload, { error: "Please log in again." });
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

void test("club serialization hides roster details from non-members", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    const club = await ClassClub.create({
        id: "private-roster",
        inviteEmails: ["invited@example.com"],
        memberEmails: ["member@example.com"],
        name: "Private Roster",
        ownerId: owner._id,
        requestEmails: ["requested@example.com"],
    });

    assert.deepEqual(serializeClub(club, "visitor").memberEmails, []);
    assert.deepEqual(serializeClub(club, "visitor").inviteEmails, []);
    assert.deepEqual(serializeClub(club, "visitor").requestEmails, []);
    assert.deepEqual(serializeClub(club, "member").memberEmails, ["member@example.com"]);
    assert.deepEqual(serializeClub(club, "owner").inviteEmails, ["invited@example.com"]);
    assert.deepEqual(serializeClub(club, "owner").requestEmails, ["requested@example.com"]);
});

void test("students request invite-only clubs with an invite code", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    const student = await User.create({ email: "student@example.com", password: "hash", verified: true });
    const club = await ClassClub.create({
        id: "coded",
        inviteCode: "ABCD1234",
        inviteEmails: ["student@example.com"],
        memberEmails: [],
        name: "Coded Club",
        ownerId: owner._id,
        requestEmails: ["student@example.com"],
    });

    const originalBaseUrl = process.env.BASE_URL;
    process.env.BASE_URL = "http://example.test";
    const link = buildClubInviteLink(club.inviteCode ?? "");
    process.env.BASE_URL = originalBaseUrl;
    const requestedClub = await requestClubWithInviteCode(student._id, "abcd-1234");
    const storedClub = await ClassClub.findOne({ id: "coded" }).lean();

    assert.equal(link, "http://example.test/clubs?code=ABCD1234");
    assert.equal(requestedClub.id, "coded");
    assert.ok(storedClub);
    assert.deepEqual(storedClub.memberEmails, []);
    assert.deepEqual(storedClub.inviteEmails, []);
    assert.deepEqual(storedClub.requestEmails, ["student@example.com"]);
});

void test("students can request to join a club and owners can approve the request", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    const student = await User.create({ email: "student@example.com", password: "hash", verified: true });
    const club = await ClassClub.create({
        id: "requestable",
        inviteEmails: [],
        memberEmails: [],
        name: "Requestable",
        ownerId: owner._id,
        requestEmails: [],
    });

    club.requestEmails = ["student@example.com"];
    await club.save();
    assert.equal(await getClubRole(club, student._id), "requested");

    club.requestEmails = club.requestEmails.filter((email) => email !== "student@example.com");
    club.memberEmails = [...new Set(["student@example.com", ...club.memberEmails])];
    await club.save();
    const storedClub = await ClassClub.findOne({ id: "requestable" }).lean();

    assert.ok(storedClub);
    assert.deepEqual(storedClub.requestEmails, []);
    assert.deepEqual(storedClub.memberEmails, ["student@example.com"]);
});

void test("legacy clubs receive an invite code before serialization", async () => {
    await ClassClub.collection.insertOne({
        id: "legacy-club",
        inviteEmails: [],
        joinPolicy: "invite",
        memberEmails: [],
        name: "Legacy Club",
        requestEmails: [],
    });
    const club = await ClassClub.findOne({ id: "legacy-club" }).lean();

    assert.ok(club);
    const inviteCode = await requireClubInviteCode(club);
    const storedClub = await ClassClub.findOne({ id: "legacy-club" }).lean();

    assert.match(inviteCode, /^[A-Z0-9]{8}$/);
    assert.equal(storedClub?.inviteCode, inviteCode);
});

void test("legacy clubs receive roster fields during migration", async () => {
    await ClassClub.collection.insertOne({
        id: "legacy-roster-fields",
        name: "Legacy Roster Fields",
    });

    const migrated = await migrateClubRosterFields();
    const storedClub = await ClassClub.findOne({ id: "legacy-roster-fields" }).lean();

    assert.equal(migrated, 4);
    assert.ok(storedClub);
    assert.deepEqual(storedClub.memberEmails, []);
    assert.deepEqual(storedClub.inviteEmails, []);
    assert.deepEqual(storedClub.requestEmails, []);
    assert.equal(storedClub.joinPolicy, "invite");
});

void test("invalid invite codes do not join clubs", async () => {
    const student = await User.create({ email: "student@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "coded",
        inviteCode: "GOOD1234",
        memberEmails: [],
        name: "Coded Club",
    });

    await assert.rejects(() => requestClubWithInviteCode(student._id, "bad-code"), /Invite code was not found/);
    const storedClub = await ClassClub.findOne({ id: "coded" }).lean();

    assert.deepEqual(storedClub?.memberEmails, []);
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

void test("legacy open clubs no longer expose contests to non-members", async () => {
    const visitor = await User.create({ email: "visitor@example.com", password: "hash", verified: true });
    const member = await User.create({ email: "member@example.com", password: "hash", verified: true });
    await ClassClub.collection.insertOne({
        id: "open-club",
        joinPolicy: "open",
        memberEmails: ["member@example.com"],
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

    assert.equal(await canAccessContest(contest, visitor._id), false);
    assert.equal(await canAccessContest(contest, member._id), true);
    assert.equal(await canAccessContest(contest), false);
});

void test("club creation limit allows edits but blocks extra new clubs", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    await ClassClub.insertMany(
        Array.from({ length: MAX_CLUBS_PER_OWNER }, (_, index) => ({
            id: `club-${index.toString()}`,
            memberEmails: [],
            name: `Club ${index.toString()}`,
            ownerId: owner._id,
        })),
    );

    await assert.rejects(() => assertClubCreationLimit(owner._id), /You can create up to/);
});

void test("contest creation limit blocks extra new club contests", async () => {
    const owner = await User.create({ email: "owner@example.com", password: "hash", verified: true });
    await ClassClub.create({
        id: "contest-limit-club",
        memberEmails: [],
        name: "Contest Limit Club",
        ownerId: owner._id,
    });
    await Contest.insertMany(
        Array.from({ length: MAX_CONTESTS_PER_CLUB }, (_, index) => ({
            accessType: "club",
            clubId: "contest-limit-club",
            endTime: new Date("2026-01-02T00:00:00Z"),
            id: `contest-${index.toString()}`,
            name: `Contest ${index.toString()}`,
            problemIds: [],
            startTime: new Date("2026-01-01T00:00:00Z"),
            timingMode: "global",
        })),
    );

    await assert.rejects(
        () =>
            saveContestWithProblems({
                accessType: "club",
                clubId: "contest-limit-club",
                endTime: new Date("2026-01-02T00:00:00Z"),
                existingProblemIds: ["a"],
                id: "one-too-many",
                inlineProblems: [],
                name: "One Too Many",
                startTime: new Date("2026-01-01T00:00:00Z"),
                timingMode: "global",
            }),
        /Clubs can create up to/,
    );
});

void test("contest problem limit rejects oversized contest payloads", async () => {
    await assert.rejects(
        () =>
            saveContestWithProblems({
                endTime: new Date("2026-01-02T00:00:00Z"),
                existingProblemIds: Array.from({ length: MAX_PROBLEMS_PER_CONTEST + 1 }, (_, index) => `p${index.toString()}`),
                id: "too-many-problems",
                inlineProblems: [],
                name: "Too Many Problems",
                startTime: new Date("2026-01-01T00:00:00Z"),
                timingMode: "global",
            }),
        /Contests can include up to/,
    );
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
