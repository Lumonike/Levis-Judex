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

import express from "express";
import fs from "fs";
import path from "path";

import { Contest } from "../models.js";
import { IContest, IProblem } from "../types/models.js";

/**
 * Contests Router
 */
const router = express.Router();
export default router;

router.get("/contests", async (req, res) => {
    const contests = await Contest.find();
    res.render("contests", { contests });
});

router.get("/contests/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "..", "public", "contests", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            res.sendFile(targetPath);
            return;
        }
    }
    const contest = await Contest.findOne({ id: target });
    if (!contest) {
        // redirect if the file doesn't exist
        res.redirect("/contests");
        return;
    }

    res.render("contest", {
        backArrow: { href: "/contests", text: "Back to Contest List" },
        contest,
        title: contest.name,
    });
});

router.get("/contests/:contestID/:problemID", async (req, res) => {
    const { contestID, problemID } = req.params;
    const contestDir = path.join(__dirname, "..", "public", "contests", contestID);
    if (fs.existsSync(path.join(contestDir, problemID))) {
        if (fs.statSync(path.join(contestDir, problemID)).isFile()) {
            res.sendFile(path.join(contestDir, problemID));
            return;
        }
    }
    const contest: IContest | null = await Contest.findOne({ id: contestID });
    if (!contest) {
        res.redirect("/contests");
        return;
    }
    const problem: IProblem | null | undefined = contest.problems.find((problem) => problem.id == problemID);
    if (!problem?.contestID) {
        res.redirect("../");
        return;
    }
    const now = new Date();

    // Check if contest is active
    if (now < contest.startTime) {
        res.render("contest-unavailable", {
            contestID: contest.id,
            reason: { text: `The contest is scheduled to start at ${contest.startTime.toLocaleString()}`, title: "Contest Not Started" },
            title: "Contest Not Started",
        });
        return;
    } else if (now >= contest.endTime) {
        res.render("contest-unavailable", {
            contestID: contest.id,
            reason: { text: `The contest ended on ${contest.endTime.toLocaleString()}`, title: "Contest Ended" },
            title: "Contest Ended",
        });
        return;
    } else {
        res.render("problem", {
            backArrow: { href: `/contests/${problem.contestID}`, text: "Back to Contest" },
            head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
                   <script type="module" src="/problems/problem-script.js" defer></script>
                   <link rel="stylesheet" href="/problems/problem-style.css"></link>`,
            problem,
            title: problem.name,
        });
        return;
    }
});
