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

import crypto from "crypto";
import express, { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { slowDown } from "express-slow-down";
import validator from "validator";

import * as judge from "../judge";
import { authenticateToken } from "../middleware/authenticate";
import { submitMiddleware } from "../middleware/problem";
import { Contest, User } from "../models";
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
    submitMiddleware((req: Request<unknown, unknown, { problemID: string }>) => {
        const problemID = req.body.problemID;
        if (typeof problemID == "string") return problemID;
        return undefined;
    }),
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

        const sanitizedContestID = contestID ? validator.escape(contestID.trim()) : null;

        const user = await User.findById(req.user?.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let problem = null;
        if (!sanitizedContestID) {
            problem = req.problem ?? null;
        } else {
            const contest = await Contest.findOne({ id: sanitizedContestID });
            if (!contest) {
                return res.status(400).json({ error: "Invalid Contest!" });
            }
            const now = new Date();
            if (now < contest.startTime) {
                return res.status(400).json({ error: "Contest hasn't started!" });
            } else if (now >= contest.endTime) {
                return res.status(400).json({ error: "Contest has already ended!" });
            }
            problem = contest.problems.find((problem) => problem.id === problemID);
        }
        if (!problem) {
            return res.status(400).json({ error: "Invalid Problem!" });
        }

        const submissionID = crypto.randomBytes(32).toString("base64url");
        judge.queueSubmission(submissionID, code, problem);
        res.json({ submissionID });

        const result = await judge.judge(submissionID);

        let combinedID = problemID;
        if (sanitizedContestID) {
            combinedID = sanitizedContestID.concat(":", problemID);
        }
        user.results.set(combinedID, result);
        user.markModified("results"); // if i don't do this, the data won't save
        user.code.set(combinedID, code);
        user.markModified("code"); // same here
        await user.save();
    },
);

/**
 * @swagger
 * TODO
 */
router.get("/sub-status", (req, res) => {
    const submissionID = req.query.submissionID;

    if (!submissionID) {
        return res.status(400).json({ error: "No submission ID provided" });
    }

    if (typeof submissionID !== "string") {
        return res.status(400).json({ error: "Submission ID must be a string" });
    }

    const sanitizedSubmissionID = validator.escape(submissionID.trim());

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.on('error', (err) => {
        console.error('SSE connection error:', err.message);
        judge.removeClient(sanitizedSubmissionID, res);
    });

    judge.addClient(sanitizedSubmissionID, res);
    res.write(`data: ${JSON.stringify(judge.getResults(sanitizedSubmissionID))}\n\n`);

    req.on('close', () => {
        judge.removeClient(sanitizedSubmissionID, res);
    });
});
