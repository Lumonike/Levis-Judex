export function displayStatus(outputArea, results, completed) {
    if (completed) {
        if (!results){
            outputArea.innerHTML = "";
            const h4 = document.createElement("h4");
            h4.textContent = "Log in to submit!";
            h4.style.margin = "0 auto";
            h4.style.textAlign = "center";
            outputArea.appendChild(h4);
            const boxContainer = document.createElement('div');
            boxContainer.className = 'box-container';
            outputArea.appendChild(boxContainer);
            return;
        }
    }
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
        testcase.style.marginBottom = "-3px";
        info.className = 'bottom-right';
        time.innerText = line.time;
        mem.innerText = line.mem;
        time.style.fontSize = "12px";
        mem.style.fontSize = "12px";
        mem.style.marginTop = "8px";
        mem.style.marginBottom = "-25px";
        symbol.style.fontSize = "30px";
        symbol.style.fontWeight = "bold";
        info.appendChild(mem);
        info.appendChild(document.createElement('br'));
        info.appendChild(time);
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
