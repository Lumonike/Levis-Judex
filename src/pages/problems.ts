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

import { sanitizeProblemHtml } from "../lib/sanitize.js";
import { authenticateTokenOptional } from "../middleware/authenticate.js";
import { problemMiddleware } from "../middleware/problem.js";
import { Problem } from "../models.js";
import { getProblemWithTestcases, getVisibleProblemQuery } from "../services/problems.js";

/**
 * Problem Router
 */
const router = express.Router();
export default router;

router.get(
    "/problems/:problemId",
    problemMiddleware((req) => req.params.problemId, "redirect"),
    async (req, res) => {
        const problem = req.problem;
        if (!problem) {
            // redirect if the file doesn't exist
            res.redirect("/problems");
            return;
        }

        const problemWithSamples = await getProblemWithTestcases(problem.id, false);
        if (!problemWithSamples) {
            res.redirect("/problems");
            return;
        }

        res.render("problem", {
            backArrow: { href: "/problems", text: "Back to Problem List" },
            head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
               <script type="module" src="/problems/problem-script.js" defer></script>
               <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css" />
               <link rel="stylesheet" href="/problems/problem-style.css" />`,
            problem: {
                ...problemWithSamples,
                inputFormat: sanitizeProblemHtml(problemWithSamples.inputFormat),
                outputFormat: sanitizeProblemHtml(problemWithSamples.outputFormat),
                problemStatement: sanitizeProblemHtml(problemWithSamples.problemStatement),
            },
            title: problem.name,
        });
    },
);

router.get("/problems", authenticateTokenOptional, async (req, res) => {
    const query = await getVisibleProblemQuery(req.user?.id);
    const problems = (await Problem.find(query)).reverse();
    res.render("problems", { problems });
});
