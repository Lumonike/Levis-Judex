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

import { problemMiddleware } from "../middleware/problem.js";
import { Problem } from "../models.js";

/**
 * Problem Router
 */
const router = express.Router();
export default router;

router.get(
    "/problems/:problemId",
    problemMiddleware((req) => req.params.problemId, "redirect"),
    (req, res) => {
        const problem = req.problem;
        if (!problem) {
            // redirect if the file doesn't exist
            res.redirect("/problems");
            return;
        }

        res.render("problem", {
            backArrow: { href: "/problems", text: "Back to Problem List" },
            head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
               <script type="module" src="/problems/problem-script.js" defer></script>
               <link rel="stylesheet" href="/problems/problem-style.css"></link>`,
            problem,
            title: problem.name,
        });
    },
);

router.get("/problems", async (req, res) => {
    const problems = await Problem.find({ isPrivate: { $ne: true } });
    res.render("problems", { problems });
});
