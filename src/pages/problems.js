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

const fs = require("fs");
const path = require("path");
const models = require("../models.js");
const html = require("../utils/html.js");

/**
 * Creates the html page for a problem at /problems/:id
 * @name createProblemHtml
 * @function
 * @param {models.ProblemModel} problem 
 * @memberof module:pages/problems
 * @returns {string} HTML string
 */
module.exports.createProblemHtml = (problem) => {
    const document = html.baseDocument();

    document.head.insertAdjacentHTML('afterbegin', `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
    <script type="module" src="/problems/problem-script.js" defer></script>
    <link rel="stylesheet" href="/problems/problem-style.css"></link>`);

    document.title = problem.name;

    const prevPage = problem.contestID == null ? "/problems" : `/contests/${problem.contestID}`;
    const prevPageName = problem.contestID == null ? "Problem List" : "Contest";
    document.body.insertAdjacentElement('afterbegin', html.backArrow(prevPage, `Back to ${prevPageName}`));

    const mainSection = document.getElementById("main-section");
    mainSection.innerHTML = fs.readFileSync(path.join(__dirname, "..", "templates", "partials", "problem.html"));
    document.getElementById("problem-name").innerHTML = problem.name;
    document.getElementById("problem-statement").innerHTML = problem.problemStatement;
    document.getElementById("input-format").innerHTML = problem.inputFormat;
    document.getElementById("output-format").innerHTML = problem.outputFormat;
    
    for (let i = 0; i < problem.numSampleTestcases; i++) {
        const problemSection = document.getElementById("problem-section");
        // prevent big space between format and samples but keep big space between samples
        if (i > 0) {
            problemSection.innerHTML += `<br><br>`;
        }
        problemSection.insertAdjacentHTML('beforeend', `<h4 class="font-bold">SAMPLE INPUT:</h4>`);
        const sampleInput = problem.inputTestcases[i].split("\n");
        for (const line of sampleInput) {
            problemSection.insertAdjacentHTML('beforeend', `<span>${line}</span><br>`);
        }
        problemSection.insertAdjacentHTML('beforeend', `<h4 class="font-bold">SAMPLE OUTPUT:</h4>`);
        const sampleOutput = problem.outputTestcases[i].split("\n");
        for (const line of sampleOutput) {
            problemSection.insertAdjacentHTML('beforeend', `<span>${line}</span>`)
        }
    }

    return document.documentElement.outerHTML;
}

/**
 * Creates the html page for the problems list at /problems
 * @name createProblemsHtml
 * @function
 * @param {models.ProblemModel[]} problemList
 * @memberof module:pages/problems
 * @returns {string} HTML string
 */
module.exports.createProblemsHtml = (problemList) => {
    const document = html.baseDocument();

    const mainSection = document.getElementById("main-section");
    mainSection.appendChild(html.homeButton());
    mainSection.appendChild(html.title("Problems List"));

    const list = document.createElement("div");
    problemList.forEach(problem => {
        list.appendChild(html.link(`/problems/${problem.id}`, `${problem.id}. ${problem.name}`, centered=true));
    });
    mainSection.appendChild(list);
    
    return document.documentElement.outerHTML;
}
