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
 * Routing for contests
 * @module pages/contests
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Contest } = require('../../models.js');

/**
 * Contests Router
 * @memberof module:pages/contests
 */
const router = express.Router();
module.exports = router;

/**
 * Gets HTML file that lists contests
 * @name GET/contests 
 * @function
 * @memberof module:pages/contests
 * @returns HTML file
 */
router.get("/contests", async (req, res) => {
    const contests = await Contest.find();
    res.render("contests", { contests });
});

/**
 * Gets the contest page of a contest
 * @name GET/contests/:target
 * @function
 * @memberof module:pages/contests
 * @param {string} req.params.target What contest to get, sometimes might be a file though so it may also return a file
 * @returns HTML file
 */
router.get("/contests/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "..", "public", "contests", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            return res.sendFile(targetPath);
        }
    }
    const contest = await Contest.findOne({ id: target });
    if (!contest) {
        // redirect if the file doesn't exist
        return res.redirect("/contests");
    }
    // res.send(createContestHtml(contest));
    res.render("contest", {
        title: contest.name,
        backArrow: { href: "/contests", text: "Back to Contest List" },
        contest
    });
});

/**
 * Gets the HTML for a problem of a contest, will prevent access if contest hasn't started/ended
 * @name GET/contests/:contestID/:problemID
 * @function
 * @memberof module:pages/contests
 * @param {string} req.params.contestID What contest the problem is in
 * @param {string} req.params.problemID What problem it is
 * @returns HTML file
 */
router.get("/contests/:contestID/:problemID", async (req, res) => {
    const { contestID, problemID } = req.params;
    const contestDir = path.join(__dirname, "..", "public", "contests", contestID);
    if (fs.existsSync(path.join(contestDir, problemID))) {
        if (fs.statSync(path.join(contestDir, problemID)).isFile()) {
            return res.sendFile(path.join(contestDir, problemID));
        }
    }
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.redirect("/contests");
    }
    const problem = contest.problems.find(problem => problem.id == problemID);
    if (!problem) {
        return res.redirect("../");
    }
    const now = new Date();

    // Check if contest is active
    if (now < contest.startTime) {
        return res.render("contest-unavailable", {
            title: "Contest Not Started",
            reason: { title: "Contest Not Started", text: `The contest is scheduled to start at ${contest.startTime.toLocaleString()}` },
            contestID: contest.id
        });
    } else if (now >= contest.endTime) {
        return res.render("contest-unavailable", {
            title: "Contest Ended",
            reason: { title: "Contest Ended", text: `The contest ended on ${contest.endTime.toLocaleString()}` },
            contestID: contest.id
        });
    } else {
        return res.render("problem", { 
            title: problem.name,
            head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
                   <script type="module" src="/problems/problem-script.js" defer></script>
                   <link rel="stylesheet" href="/problems/problem-style.css"></link>`, 
            backArrow: { href: `/contests/${problem.contestID}`, text: "Back to Contest" },
            problem 
        });
    }
});