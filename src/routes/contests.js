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

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Contest } = require('../models.js');
const { createProblemHtml } = require("../pages/problems.js");
const router = express.Router();
module.exports = router;

// TODO: should be GET
router.post("/contests", async (req, res) => {
    const contests = await Contest.find();
    const data = [];
    contests.forEach((contest) => {
        data.push({ id: contest.id, name: contest.name });
    })
    res.json(data);
});

// TODO: should be get
router.post("/contestProblems", async (req, res) => {
    const { contestID } = req.body;
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.sendStatus(404);
    }
    const data = [];
    contest.problems.forEach((problem) => {
        data.push({ id: problem.id, name: problem.name });
    });
    res.json(data);
});

// TODO: should be GET
// startTime and endTime are strings. do Date.parse
router.post("/contestTiming", async (req, res) => {
    const { contestID } = req.body;
    const contest = await Contest.findOne({ id: contestID });
    if (!contest) {
        return res.sendStatus(404);
    }
    res.json({ startTime: contest.startTime, endTime: contest.endTime });
});

// copy paste from problems lmfao
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
    // TODO: Fix problems list thing lmao
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${contest.name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-100">
            <header class="p-4">

                <a href="/contests" class="text-blue-400 hover:underline">← Back to Contest List</a>
            </header>

            <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">

                <a href="/" style="position: fixed">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 21V12H15V21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </a>

                <h1 class="text-4xl font-bold text-center mb-6">${contest.name}</h1><br>
                <h1 class="text-2xl font-bold text-center mb-6" id="contestTiming"></h1><br>
                <!-- Uncomment to enable link -->
                <div id="problem-list" class="text-2xl space-y-4 block text-blue-400 text-center mb-4"></div>
            </div>

            <style>.hoverUnderline:hover{text-decoration: underline;}</style>
            <script type="module">
                import { getTiming, apply } from "/contests/getTiming.js";
                import { loadProblems } from "/contests/getContestProblems.js";
                let elem = document.getElementById("contestTiming");
                const { startTime, endTime } = await getTiming(${contest.id});
                setInterval(apply, 100, elem, startTime, endTime); // repeat every 100 ms
                loadProblems(${contest.id});
            </script>
        </body>
        </html>    
    `);
});

// TODO: put html stuff into its own file probably cuz this sucks lmfao
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
        // Contest not started yet
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Contest Not Started</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-900 text-gray-100">
                <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                    <h1 class="text-4xl font-bold text-center mb-6 text-red-500">Contest Not Started Yet</h1>
                    <p class="text-center text-2xl mb-6">The contest is scheduled to start at ${contest.startTime.toLocaleString()}</p>
                    <div class="text-center">
                        <a href="/contests/${contestID}" class="text-blue-400 hover:underline">← Back to Contest</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (now >= contest.endTime) {
        // Contest has ended
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Contest Ended</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-900 text-gray-100">
                <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                    <h1 class="text-4xl font-bold text-center mb-6 text-red-500">Contest Ended</h1>
                    <p class="text-center text-2xl mb-6">The contest ended on ${contest.endTime.toLocaleString()}</p>
                    <div class="text-center">
                        <a href="/contests/${contestID}" class="text-blue-400 hover:underline">← Back to Contest</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else {
        return res.send(createProblemHtml(problem));
    }
});