import assert from "node:assert/strict";
import test from "node:test";

import adminRouter from "../src/api/admin";
import { judge, queueSubmission } from "../src/judge";
import { sanitizeProblemHtml } from "../src/lib/sanitize";
import { createToken, hashToken } from "../src/lib/tokens";
import { IProblem } from "../src/types/models";

test("problem html sanitizer removes executable content while preserving formatting", () => {
    const sanitized = sanitizeProblemHtml('<h2>Title</h2><img src=x onerror="alert(1)"><script>alert(2)</script><p>Body</p>');

    assert.match(sanitized, /<h2>Title<\/h2>/);
    assert.match(sanitized, /<p>Body<\/p>/);
    assert.doesNotMatch(sanitized, /script/i);
    assert.doesNotMatch(sanitized, /onerror/i);
});

test("reset tokens are hashable without storing the raw token", () => {
    const token = createToken();
    const tokenHash = hashToken(token);

    assert.notEqual(tokenHash, token);
    assert.equal(hashToken(token), tokenHash);
    assert.equal(tokenHash.length, 64);
});

test("delete-problem route includes authentication and admin authorization", () => {
    type RouteLayer = {
        route?: {
            methods: Record<string, boolean>;
            path: string;
            stack: { handle: { name: string } }[];
        };
    };

    const layer = (adminRouter.stack as RouteLayer[]).find((item) => item.route?.path === "/delete-problem" && item.route.methods.delete);

    assert.ok(layer?.route);
    assert.deepEqual(
        layer.route.stack.map((item) => item.handle.name),
        ["authenticateToken", "requireAdmin", ""],
    );
});

test("oversized submissions fail without needing an isolate box", async () => {
    const problem: IProblem = {
        id: "oversized",
        inputFormat: "",
        inputTestcases: [""],
        name: "Oversized",
        numSampleTestcases: 0,
        outputFormat: "",
        outputTestcases: [""],
        problemStatement: "",
    };
    const submissionID = "oversized-submission";

    queueSubmission(submissionID, "x".repeat(100001), problem);
    const result = await judge(submissionID);

    assert.deepEqual(result, [{ mem: "0 MB", status: "RTE", time: "0s" }]);
});
