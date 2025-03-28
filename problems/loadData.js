import { server } from './getServer.js';
import { displayStatus } from './status.js'

export async function fetchLastCode(problem, editor) {
    fetch(`${server}/getCode`, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ problem })
    })
    .then(response => response.json())
    .then(data => {
        if (data.result != undefined) {
            editor.setValue(data.result);
        }
    });
}

export async function displayPastResults(problem) {
    fetch(`${server}/getResult`, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ problem })
    })
    .then(response => response.json())
    .then(data => {
        if (data.result != undefined) {
            const outputArea = document.getElementById("result");
            outputArea.className += "outline rounded-xl";
            displayStatus(outputArea, data.result, true);
        }
    });
}