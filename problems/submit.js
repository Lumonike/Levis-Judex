import { server } from './getServer.js';

let alreadySubmitting = false;

export async function submitCode(code, problem, testcaseCount) {
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
    const completedResults = submit(code, problem, testcaseCount).then((res) => {
        completed = true;
        return res;
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

async function submit(code, problem, testcaseCount) {
    try {
        const response = await fetch(`${server}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, problem, testcaseCount })
        });
        const data = await response.json();
        console.log(data);
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
            headers: { "Content-Type": "application/json" },
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

function displayStatus(outputArea, results, completed) {
    outputArea.innerHTML = "";
    const h4 = document.createElement("h4");
    h4.textContent = completed ? "Submitted! View results below:" : "Processing code...";
    h4.style.margin = "0 auto";
    h4.style.textAlign = "center";
    outputArea.appendChild(h4);
    const boxContainer = document.createElement('div');
    boxContainer.className = 'box-container';
    results.forEach((line, index) => {
        const box = document.createElement('div');
        const symbol = document.createElement('h1');
        const bottom = document.createElement('div');
        const testcase = document.createElement('span');
        const info = document.createElement('div');
        const time = document.createElement('p');
        const mem = document.createElement('p');
        box.className = 'box';
        box.style.fontFamily = "Arial";
        symbol.style.textAlign = 'center';
        symbol.style.marginBottom = '-13px';
        bottom.className = 'bottom';
        testcase.innerText = `${index+1}`;
        testcase.className = "bottom-left";
        testcase.style.fontSize = "15px";
        testcase.style.marginBottom = "-1px";
        info.className = 'bottom-right';
        time.innerText = line.time;
        mem.innerText = line.mem;
        time.style.fontSize = "13px";
        mem.style.fontSize = "13px";
        time.style.marginTop = "8px";
        time.style.marginBottom = "-25px";
        symbol.style.fontSize = "30px";
        symbol.style.fontWeight = "bold";
        info.appendChild(time);
        info.appendChild(document.createElement('br'));
        info.appendChild(mem);
        bottom.appendChild(testcase);
        bottom.appendChild(info);
        setBox(box, symbol, line);
        box.appendChild(symbol);
        box.appendChild(bottom);
        boxContainer.appendChild(box);
    });
    outputArea.appendChild(boxContainer);
}

function setBox(box, symbol, line) {
    symbol.innerText = line.status;
    switch (line.status) {
    case "AC":
        box.style.outline = "1px solid green";
        box.style.color = "green";
        box.style.backgroundColor = "lightgreen";
        box.title = "Accepted";
        break;
    case "WA":
        box.style.outline = "1px solid red";
        box.style.color = "red";
        box.style.backgroundColor = "pink";
        box.title = "Wrong Answer";
        break;
    case "TLE":
        box.style.outline = "1px solid red";
        box.style.color = "red";
        box.style.backgroundColor = "pink";
        box.title = "Time Limit Exceeded";
        break;
    case "RTE":
        box.style.outline = "1px solid red";
        box.style.color = "red";
        box.style.backgroundColor = "pink";
        box.title = "Runtime Error";
        break;
    case "MLE":
        box.style.outline = "1px solid red";
        box.style.color = "red";
        box.style.backgroundColor = "pink";
        box.title = "Memory Limit Exceeded";
        break;
    default:
        symbol.innerText = "..."
        box.style.outline = "1px solid gray";
        box.style.backgroundColor = "lightgray";
        box.title = line;
        break;
    }
}
