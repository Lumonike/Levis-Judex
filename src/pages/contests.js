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
 * @module pages/contests
 */

const models = require("../models.js");
const html = require("../utils/html.js");

/**
 * Creates HTML for contest list at /contests
 * @name createContestsHtml
 * @function
 * @param {models.ContestModel[]} contestList 
 * @memberof module:pages/contests
 * @returns {string} HTML string
 */
module.exports.createContestsHtml = (contestList) => {
    const document = html.baseDocument();
    document.title = "Contests"
    const mainSection = document.getElementById("main-section");
    mainSection.appendChild(html.homeButton());
    mainSection.appendChild(html.title("Contests List"));
    const list = document.createElement("div");
    contestList.forEach(contest => {
        list.appendChild(html.link(`/contests/${contest.id}`, `${contest.id}. ${contest.name}`, centered=true));
    });
    mainSection.appendChild(list);
    
    return document.documentElement.outerHTML;
}

/**
 * Creates Html for the contest page at /contest/:contestID
 * @name createContestHtml
 * @function
 * @param {models.ContestModel} contest
 * @memberof module:pages/contests
 * @returns {string} Html string
 */
module.exports.createContestHtml = (contest) => {
    const document = html.baseDocument();
    document.title = contest.name;
    document.body.insertAdjacentElement('afterbegin', html.backArrow("/contests", "Back to Contest List"));

    const mainSection = document.getElementById("main-section");
    mainSection.appendChild(html.homeButton());
    mainSection.appendChild(html.title(contest.name));

    const contestTiming = html.text("", true);
    contestTiming.id = "contest-timing";
    mainSection.appendChild(contestTiming);

    const list = document.createElement("div");
    contest.problems.forEach(problem => {
        list.appendChild(html.link(`/contests/${contest.id}/${problem.id}`, `${problem.id}. ${problem.name}`, centered=true));
    });
    mainSection.appendChild(list);
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
        import { apply } from "/contests/update-timing.js";
        let elem = document.getElementById("contest-timing");
        const startTime = new Date("${contest.startTime.toISOString()}");
        const endTime = new Date("${contest.endTime.toISOString()}");
        setInterval(apply, 100, elem, startTime, endTime); // repeat every 100 ms
    `;
    document.body.appendChild(script);

    return document.documentElement.outerHTML;
}

/**
 * Creates an HTML for /contests/:contestID/:problemID when the contest hasn't started yet
 * @name createContestNotStartedHtml
 * @function
 * @param {models.ContestModel} contest
 * @memberof module:pages/contests 
 * @returns {string} Html string
 */
module.exports.createContestNotStartedHtml = (contest) => {
    const document = html.baseDocument();
    document.title = "Contest Not Started";
    const mainSection = document.getElementById("main-section");

    mainSection.appendChild(html.title("Contest Not Started", "text-red-500"));
    mainSection.appendChild(html.text(`The contest is scheduled to start at ${contest.startTime.toLocaleString()}`, true));
    
    const backArrow = html.backArrow("/contests/${contest.id}", "Back to Contest");
    backArrow.className = "text-center";
    mainSection.appendChild(backArrow);

    return document.documentElement.outerHTML;
}

/**
 * Creates an HTML for /contests/:contestID/:problemID when the contest has already ended
 * @name createContestEndedHtml
 * @function
 * @param {models.ContestModel} contest
 * @memberof module:pages/contests 
 * @returns {string} Html string
 */
module.exports.createContestEndedHtml = (contest) => {
    const document = html.baseDocument();
    document.title = "Contest Ended";
    const mainSection = document.getElementById("main-section");

    mainSection.appendChild(html.title("Contest Ended", "text-red-500"));
    mainSection.appendChild(html.text(`The contest ended on ${contest.endTime.toLocaleString()}`, true))

    const backArrow = html.backArrow("/contests/${contest.id}", "Back to Contest");
    backArrow.className = "text-center";
    mainSection.appendChild(backArrow);

    return document.documentElement.outerHTML;
}
