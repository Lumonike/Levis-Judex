/* Levis Judex - Self-hosted platform for contests/problems
 * Copyright (C) 2025 Vincent Li and Robin Wang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express, { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { slowDown } from "express-slow-down";
import { Types } from "mongoose";
import validator from "validator";

import * as judge from "../judge";
import { authenticateToken } from "../middleware/authenticate";
import { Submission, User } from "../models";
import { canAccessContest, findContestByStorageId, getContestState } from "../services/contests";
import { getContestProblem, getProblemWithTestcases } from "../services/problems";
import { createSubmission } from "../services/submissions";
import { ApiError } from "../types/api";

/**
 * Submission Router
 */
const router = express.Router();
export default router;

// 60 submissions per hour
const submissionLimiter = rateLimit({
    keyGenerator: (req) => req.user?.id.toString() ?? "",
    legacyHeaders: false,
    limit: 60,
    message: { error: "Too many submissions! Rate limit exceeded." },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

const submissionSlowdown = slowDown({
    delayAfter: 5,
    delayMs: (hits) => (hits - 5) * 2000,
    keyGenerator: (req) => req.user?.id.toString() ?? "",
    maxDelayMs: 15000,
    windowMs: 60 * 1000,
});

/**
 * @swagger
 * TODO
 */
router.post(
    "/",
    authenticateToken,
    submissionSlowdown,
    submissionLimiter,
    async (req: Request<unknown, ApiError, { code: string; contestID?: string; problemID?: string }>, res: Response) => {
        const { code, contestID, problemID } = req.body;

        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "Code is required and must be a string" });
        }

        if (!problemID || typeof problemID !== "string") {
            return res.status(400).json({ error: "Problem ID is required and must be a string" });
        }

        if (contestID && typeof contestID !== "string") {
            return res.status(400).json({ error: "Contest ID must be a string" });
        }

        if (code.length > 100000) {
            return res.status(400).json({ error: "Code is too long (max 100,000 characters)" });
        }

        if (code.length === 0) {
            return res.status(400).json({ error: "Code cannot be empty" });
        }

        const sanitizedProblemID = validator.escape(problemID.trim());
        const sanitizedContestID = contestID ? validator.escape(contestID.trim()) : null;

        const user = await User.findById(req.user?.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let problem = null;
        let contestScored = false;
        if (!sanitizedContestID) {
            problem = await getProblemWithTestcases(sanitizedProblemID, true);
        } else {
            const contest = await findContestByStorageId(sanitizedContestID);
            if (!contest) {
                return res.status(400).json({ error: "Invalid Contest!" });
            }
            if (!(await canAccessContest(contest, user._id))) {
                return res.status(403).json({ error: "Contest is restricted" });
            }
            const state = await getContestState(contest, user._id);
            if (!state.canViewProblems) {
                return res.status(400).json({ error: "Contest is not available yet." });
            }
            contestScored = state.canSubmitForScore;
            problem = await getContestProblem(contest, sanitizedProblemID, true);
        }
        if (!problem) {
            return res.status(400).json({ error: "Invalid Problem!" });
        }

        if (problem.isPrivate && !user.admin && !problem.whitelist?.some((id) => id.equals(user._id))) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const submissionID = await createSubmission({
            code,
            contestId: sanitizedContestID,
            contestScored,
            problem,
            userId: user._id,
        });
        res.json({ submissionID });
    },
);

/**
 * @swagger
 * TODO
 */
router.get("/sub-status", authenticateToken, async (req, res) => {
    const submissionID = req.query.submissionID;

    if (!submissionID) {
        return res.status(400).json({ error: "No submission ID provided" });
    }

    if (typeof submissionID !== "string") {
        return res.status(400).json({ error: "Submission ID must be a string" });
    }

    const sanitizedSubmissionID = validator.escape(submissionID.trim());
    if (!Types.ObjectId.isValid(sanitizedSubmissionID)) {
        return res.status(400).json({ error: "Invalid submission ID" });
    }

    const submission = await Submission.findById(sanitizedSubmissionID);
    if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
    }

    const user = await User.findById(req.user?.id).select("admin");
    if (!user || (!user.admin && !submission.userId.equals(user._id))) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.on("error", (err) => {
        console.error("SSE connection error:", err.message);
        judge.removeClient(sanitizedSubmissionID, res);
    });

    res.write(`data: ${JSON.stringify(submission.results)}\n\n`);
    if (submission.status === "completed" || submission.status === "failed") {
        res.write(`event: done\ndata: ${JSON.stringify(submission.results)}\n\n`);
        res.end();
        return;
    }

    judge.addClient(sanitizedSubmissionID, res);

    req.on("close", () => {
        judge.removeClient(sanitizedSubmissionID, res);
    });
});
