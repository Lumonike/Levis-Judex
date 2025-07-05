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
 * @module routes/submit
 */

const express = require('express');
const authenticateToken = require('../authenticate.js')
const { User, Problem, Contest } = require('../models.js');
const judge = require('../judge.js');
const router = express.Router();
module.exports = router;

/**
 * Submits code, requires login
 * @name POST/submit
 * @function
 * @memberof module:routes/submit
 * @param {string} req.body.code Code written by submitter
 * @param {string} req.body.problemID Problem the code is meant for
 * @param {string | null} req.body.contestID Contest the code is meant for, null is not part of any contest
 * @returns {judge.Result} Results of submitting
 */
router.post("/submit", authenticateToken, async (req, res) => {
    const { code, problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    let problem = null;
    if (!contestID) {
        problem = await Problem.findOne({ id: problemID });
    } else {
        const contest = await Contest.findOne({ id: contestID });
        if (!contest) {
            return res.sendStatus(400);
        }
        problem = contest.problems.find(problem => problem.id == problemID);
    }
    if (!problem) {
        return res.sendStatus(400);
    }
    const result = await judge.judge(code, problem);
    res.json({ result });
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    user.results[combinedID] = result;
    user.markModified('results'); // if i don't do this, the data won't save
    user.code[combinedID] = code;
    user.markModified('code');
    await user.save();
});

// TODO: fix /submit so that this doesn't need to exist
router.post("/available", (req, res) => {
    const result = judge.getBoxID();
    res.json({ result });
});

/**
 * Gets submission results while code is running (TODO: should be GET request lol)
 * @name POST/sub-status
 * @function
 * @memberof module:routes/submit
 * @param {number} req.body.boxID What box to get results so far
 * @returns {judge.Result} Current results of submission so far
 */
router.post("/sub-status", authenticateToken, (req, res) => {
    const { boxID } = req.body;
    const result = judge.getStatus(boxID);
    res.json({ result });
});