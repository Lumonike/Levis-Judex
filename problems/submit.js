import { server } from './getServer.js';
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
        const response = await fetch(`${server}/available`, {
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

        const response = await fetch(`${server}/submit`, {
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
        const response = await fetch(`${server}/subStatus`, {
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
