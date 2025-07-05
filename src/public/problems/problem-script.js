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

import { submitCode } from "/problems/submit.js";
import { fetchLastCode, displayPastResults } from "/problems/load-data.js";

const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');


const url = window.location.pathname.split("/");
if (url.at(-1) == "") {
    url.pop();
}
let contestID = null;
if (url.at(-3) == "contests") {
    contestID = url.at(-2);
}
const problemID = url.at(-1);
console.log(contestID);
console.log(problemID);
// set up listener for run button
document.getElementById("submit-button").onclick = () => { submitCode(editor.getValue(), problemID, contestID) };
fetchLastCode(problemID, contestID, editor);
displayPastResults(problemID, contestID);
