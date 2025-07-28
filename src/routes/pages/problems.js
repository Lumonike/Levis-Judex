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
 * @module pages/problems
 */

const express = require('express');
const fs = require('fs');
const path = require("path");
const { Problem } = require('../../models.js');

/**
 * Problem Router
 * @memberof module:pages/problems
 */
const router = express.Router();
module.exports = router;

/**
 * Sends HTML of a problem
 * @name GET/problems/:target
 * @function
 * @memberof module:pages/problems
 * @returns HTML file
 */
router.get("/problems/:target", async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "..", "public", "problems", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            return res.sendFile(targetPath);
        }
    }
    const problem = await Problem.findOne({ id: target });
    if (problem == null) {
        // redirect if the file doesn't exist
        return res.redirect("/problems");
    }
    
    res.render("problem", { 
        title: problem.name,
        head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
               <script type="module" src="/problems/problem-script.js" defer></script>
               <link rel="stylesheet" href="/problems/problem-style.css"></link>`,
        backArrow: { href: "/problems", text: "Back to Problem List" },
        problem 
    });
});

/**
 * Sends HTML of the list of problems
 * @name GET/problems
 * @function
 * @memberof module:pages/problems
 * @returns HTML file
 */
router.get("/problems", async (req, res) => {
    const problems = await Problem.find();
    res.render("problems", { problems });
});
