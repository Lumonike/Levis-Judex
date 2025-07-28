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

import { displayStatus } from './status.js';

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
    let boxID = await checkGradingServer();
    while (boxID == -1) {
        outputArea.innerHTML = "Waiting for grading server...";
        await new Promise(resolve => setTimeout(resolve, 500));
        boxID = await checkGradingServer();
    }
    let completed = false;
    const completedResults = submit(code, problemID, contestID).then((res) => {
        completed = true;
        return res;
    }).catch((error) => {
        completed = true;
        console.log(error);
        return null;
    });

    while (!completed) {
        const curResult = await getStatus(boxID);
        displayStatus(outputArea, curResult, completed);
    }
    displayStatus(outputArea, await completedResults, completed);
    alreadySubmitting = false;
}

async function checkGradingServer() {
    try {
        const response = await fetch(`/api/submit/available`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error(error.message);
    }
}

async function submit(code, problemID, contestID) {
    try {
        // console.log({
        //     method: "POST",
        //     headers: { 
        //         "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        //         "Content-Type": "application/json"
        //     },
        //     body: JSON.stringify({ code, problemID })
        // });

        const response = await fetch(`/api/submit`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ code, problemID, contestID })
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.result;
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getStatus(boxID) {
    try {
        const response = await fetch(`/api/submit/sub-status`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ boxID })
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.result;
    } catch (error) {
        console.error(error.message);
    }
}
