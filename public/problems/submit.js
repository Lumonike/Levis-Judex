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

let alreadySubmitting = false;

export async function submitCode(code, problemID, contestID) {
    if (alreadySubmitting) {
        return;
    }
    alreadySubmitting = true;
    console.log("Attempted to submit code!");

    const outputArea = document.getElementById("result");
    outputArea.className += "outline rounded-xl";
    scroll(0, 0);

    await fetch(`/api/submit`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, problemID, contestID }),
    })
        .then(async (res) => {
            const parsed = await res.json();
            if (!res.ok) {
                if (res.status == 403) {
                    throw new Error("Login to submit!");
                }
                throw new Error(parsed.error);
            }
            return parsed;
        })
        .then(({ submissionID }) => {
            if (!submissionID) {
                throw new Error("Server responded with invalid submission ID");
            }
            const eventSource = new EventSource(`/api/submit/sub-status?submissionID=${submissionID}`);
            eventSource.onmessage = (ev) => {
                const curResults = JSON.parse(ev.data);
                displayStatus(outputArea, curResults, false);
            };
            eventSource.onerror = () => {
                throw new Error("Server had an error with submitting");
            };
            eventSource.addEventListener("done", (ev) => {
                const completedResults = JSON.parse(ev.data);
                displayStatus(outputArea, completedResults, true);
                eventSource.close();
            });
        })
        .catch((err) => {
            displayStatus(outputArea, [], false, err.message);
        });
    alreadySubmitting = false;
}
