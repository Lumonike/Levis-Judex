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
        h4.style.color = "#EF4444";
        h4.style.fontSize = "18px";
        h4.style.fontWeight = "600";
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
        h4.style.color = "#ffffff";
    } else if (results.length == 0) {
        h4.textContent = "Waiting for available grading server...";
        h4.style.color = "#F59E0B";
    } else {
        h4.textContent = "Processing code...";
        h4.style.color = "#3B82F6";
    }
    h4.style.margin = "0 auto";
    h4.style.textAlign = "center";
    h4.style.fontSize = "18px";
    h4.style.fontWeight = "600";
    h4.style.marginBottom = "16px";
    outputArea.appendChild(h4);
    
    const boxContainer = document.createElement('div');
    boxContainer.className = 'box-container';
    
    results.forEach((line, index) => {
        const box = document.createElement('div');
        const statusSymbol = document.createElement('div');
        const testcaseInfo = document.createElement('div');
        const testcaseNumber = document.createElement('span');
        const metrics = document.createElement('div');
        const timeMetric = document.createElement('p');
        const memMetric = document.createElement('p');
        
        box.className = 'modern-box';
        statusSymbol.className = 'status-symbol';
        testcaseInfo.className = 'testcase-info';
        testcaseNumber.className = 'testcase-number';
        metrics.className = 'metrics';
        timeMetric.className = 'metric-text';
        memMetric.className = 'metric-text';
        
        testcaseNumber.textContent = `${index + 1}`;
        timeMetric.textContent = line.time;
        memMetric.textContent = line.mem;
        
        metrics.appendChild(memMetric);
        metrics.appendChild(timeMetric);
        
        testcaseInfo.appendChild(testcaseNumber);
        testcaseInfo.appendChild(metrics);
        
        setModernBox(box, statusSymbol, line);
        
        box.appendChild(statusSymbol);
        box.appendChild(testcaseInfo);
        boxContainer.appendChild(box);
    });
    
    outputArea.appendChild(boxContainer);
}

function setModernBox(box, statusSymbol, line) {
    statusSymbol.textContent = line.status;
    
    switch (line.status) {
        case "AC":
            box.className = 'modern-box accepted';
            box.title = "Accepted";
            statusSymbol.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
            break;
        case "WA":
            box.className = 'modern-box wrong-answer';
            box.title = "Wrong Answer";
            statusSymbol.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            `;
            break;
        case "TLE":
            box.className = 'modern-box time-limit';
            box.title = "Time Limit Exceeded";
            statusSymbol.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            `;
            break;
        case "RTE":
            box.className = 'modern-box runtime-error';
            box.title = "Runtime Error";
            statusSymbol.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
            `;
            break;
        case "MLE":
            box.className = 'modern-box memory-limit';
            box.title = "Memory Limit Exceeded";
            statusSymbol.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
            `;
            break;
        default:
            box.className = 'modern-box pending';
            box.title = line;
            statusSymbol.innerHTML = `
                <div class="loading-spinner"></div>
            `;
            break;
    }
}
