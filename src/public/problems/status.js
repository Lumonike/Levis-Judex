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

export function displayStatus(outputArea, results, completed, err=undefined) {
    if (err) {
        outputArea.innerHTML = "";
        const h4 = document.createElement("h4");
        h4.textContent = err;
        h4.style.margin = "0 auto";
        h4.style.textAlign = "center";
        outputArea.appendChild(h4);
        const boxContainer = document.createElement('div');
        boxContainer.className = 'box-container';
        outputArea.appendChild(boxContainer);
        return;
    }
    outputArea.innerHTML = "";
    const h4 = document.createElement("h4");
    if (completed) {
        h4.textContent = "Submitted! View results below:";
    } else if (results.length == 0) {
        h4.textContent = "Waiting for available grading server...";
    } else {
        h4.textContent = "Processing code...";
    }
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
