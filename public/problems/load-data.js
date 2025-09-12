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

import { displayStatus } from "./status.js";

export async function fetchLastCode(problemID, contestID, editor) {
    fetch(`/api/user/get-code`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ problemID, contestID }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.result != undefined) {
                editor.setValue(data.result);
            }
        });
}

export async function displayPastResults(problemID, contestID) {
    fetch(`/api/user/get-result`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ problemID, contestID }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.result != undefined) {
                const outputArea = document.getElementById("result");
                outputArea.className += "outline rounded-xl";
                displayStatus(outputArea, data.result, true);
            }
        });
}
