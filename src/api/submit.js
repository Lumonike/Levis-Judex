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

/**
 * @module api/submit
 */

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { slowDown } = require("express-slow-down");
const validator = require("validator");

const authenticateToken = require("../authenticate.js");
const judge = require("../judge.js");
const { Contest, Problem, User } = require("../models.js");

/**
 * Submission Router
 * @memberof module:api/submit
 */
const router = express.Router();
module.exports = router;

// 60 submissions per hour
const submissionLimiter = rateLimit({
    keyGenerator: (req) => req.user.id,
    legacyHeaders: false,
    limit: 60,
    message: { error: "Too many submissions! Rate limit exceeded." },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

const submissionSlowdown = slowDown({
    delayAfter: 5,
    delayMs: (hits) => (hits - 5) * 2000,
    keyGenerator: (req) => req.user.id,
    maxDelayMs: 15000,
    windowMs: 60 * 1000,
});

/**
 * Submits code, requires login
 * @name POST/api/submit/
 * @function
 * @memberof module:api/submit
 * @param {string} req.body.code Code written by submitter
 * @param {string} req.body.problemID Problem the code is meant for
 * @param {string | null} req.body.contestID Contest the code is meant for, null is not part of any contest
 * @returns {string} .submissionID for submission ID
 */
router.post("/", authenticateToken, submissionSlowdown, submissionLimiter, async (req, res) => {
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

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    let problem = null;
    if (!sanitizedContestID) {
        problem = await Problem.findOne({ id: sanitizedProblemID });
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
        problem = contest.problems.find((problem) => problem.id === sanitizedProblemID);
    }
    if (!problem) {
        return res.status(400).json({ error: "Invalid Problem!" });
    }

    const submissionID = require("crypto").randomBytes(32).toString("base64url");
    judge.queueSubmission(submissionID, code, problem);
    res.json({ submissionID });

    const result = await judge.judge(submissionID);

    let combinedID = sanitizedProblemID;
    if (sanitizedContestID) {
        combinedID = sanitizedContestID.concat(":", sanitizedProblemID);
    }
    user.results[combinedID] = result;
    user.markModified("results"); // if i don't do this, the data won't save
    user.code[combinedID] = code;
    user.markModified("code"); // same here
    await user.save();
});

/**
 * Event stream that gets submission results while code is running
 * @name GET/api/submit/sub-status
 * @function
 * @memberof module:api/submit
 * @param {string} req.query.submissionID
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

    judge.addClient(sanitizedSubmissionID, res);
    res.write(`data: ${JSON.stringify(judge.getResults(sanitizedSubmissionID))}\n\n`);
});
