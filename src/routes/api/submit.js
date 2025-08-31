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

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { slowDown } = require('express-slow-down');
const authenticateToken = require('../../authenticate.js')
const { User, Problem, Contest } = require('../../models.js');
const judge = require('../../judge.js');

/**
 * Submission Router
 * @memberof module:api/submit
 */
const router = express.Router();
module.exports = router;

// 60 submissions per hour
const submissionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: "Too many submissions! Rate limit exceeded." },
    keyGenerator: (req) => req.user.id,
});

const submissionSlowdown = slowDown({
    windowMs: 60 * 1000,
    delayAfter: 5,
    delayMs: (hits) => (hits - delayAfter) * 2000,
    maxDelayMs: 15000,
    keyGenerator: (req) => req.user.id,
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
    const { code, problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    let problem = null;
    if (!contestID) {
        problem = await Problem.findOne({ id: problemID });
    } else {
        const contest = await Contest.findOne({ id: contestID });
        if (!contest) {
            return res.status(400).json({ error: "Invalid Contest!" });
        }
        const now = new Date();
        if (now < contest.startTime) {
            return res.status(400).json({ error: "Contest hasn't started!" });
        } else if (now >= contest.endTime) {
            return res.status(400).json({ error: "Contest has already ended!" });
        }
        problem = contest.problems.find(problem => problem.id == problemID);
    }
    if (!problem) {
        return res.status(400).json({ error: "Invalid Problem!" });
    }

    const submissionID = require("crypto").randomBytes(32).toString("base64url");
    judge.queueSubmission(submissionID, code, problem);
    res.json({ submissionID });

    const result = await judge.judge(submissionID);

    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    user.results[combinedID] = result;
    user.markModified('results'); // if i don't do this, the data won't save
    user.code[combinedID] = code;
    user.markModified('code'); // same here
    await user.save();
})

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
        return res.status(400).json("No submission ID provided");
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    judge.addClient(submissionID, res);
    res.write(`data: ${JSON.stringify(judge.getResults(submissionID))}\n\n`);
});
