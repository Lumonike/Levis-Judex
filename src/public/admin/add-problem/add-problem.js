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

const getId = document.getElementById.bind(document);
let inputTestcases = [];
let outputTestcases = [];
const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    ['link'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }]
];

const quillCSS = document.createElement('link');
quillCSS.rel = 'stylesheet';
quillCSS.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
document.head.appendChild(quillCSS);
const quillScript = document.createElement('script');
quillScript.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
document.head.appendChild(quillScript);
quillScript.onload = () => {
    // ensure all of that is loaded
    const interval = setInterval(() => {
        if (getId("problem-statement") && getId("input-format") && getId("output-format")) {
            clearInterval(interval);
            window.problemStatementContainer = new Quill('#problem-statement', { modules: { toolbar: toolbarOptions }, theme: 'snow' });
            window.inputFormatContainer = new Quill('#input-format', { modules: { toolbar: toolbarOptions }, theme: 'snow' });
            window.outputFormatContainer = new Quill('#output-format', { modules: { toolbar: toolbarOptions }, theme: 'snow' });
            addSymbolButtons();
        }
    }, 100);
};

function addSymbolButtons() {
    document.querySelectorAll('.ql-toolbar').forEach(toolbar => {
        const container = toolbar.nextElementSibling;
        if (!container) return;

        const quill = Quill.find(container);
        if (!quill) return;

        // Create a new toolbar group to match Quill's format
        const formatGroup = document.createElement('span');
        formatGroup.className = 'ql-formats';

        // Helper: create a symbol button
        function createSymbolButton(symbol) {
            const button = document.createElement('button');
            button.type = 'button';
            button.innerHTML = `<span style="padding=0; font-size:20px; line-height:1;">${symbol}</span>`;

            // Use mousedown to preserve cursor/selection
            button.addEventListener('mousedown', e => {
                e.preventDefault();
                const range = quill.getSelection(true);
                if (!range) return;
                quill.deleteText(range.index, range.length);
                quill.insertText(range.index, symbol, 'user');
                quill.setSelection(range.index + 1, 0, 'user');
            });

            return button;
        }

        formatGroup.appendChild(createSymbolButton('≤'));
        formatGroup.appendChild(createSymbolButton('≥'));

        toolbar.appendChild(formatGroup);
    });
}

async function loadProblem() {
    const id = getId("problem-id-search").value.trim();
    if (!id) return alert("Please enter a problem ID.");
    try {
        const res = await fetch(`/problem-json?id=${id}`);
        if (!res.ok) throw new Error("Problem not found");
        const data = await res.json();
        populateForm(data);
    } catch (err) {
        alert("Failed to load problem: " + err.message);
    }
}

function populateForm(data) {
    getId("id").value = data.id;
    getId("name").value = data.name;
    // can't be that dangerous right?
    problemStatementContainer.clipboard.dangerouslyPasteHTML(data.problemStatement);
    inputFormatContainer.clipboard.dangerouslyPasteHTML(data.inputFormat);
    outputFormatContainer.clipboard.dangerouslyPasteHTML(data.outputFormat);
    getId("num-testcases").value = data.inputTestcases.length;
    getId("num-sample-testcases").value = data.numSampleTestcases;

    inputTestcases = [...data.inputTestcases];
    outputTestcases = [...data.outputTestcases];
    // $("contest-id").value = data.contestID || "";
    
    fillDropdown();
}

function fillDropdown() {
    const total = parseInt(getId("num-testcases").value);
    const samples = parseInt(getId("num-sample-testcases").value);
    const selector = getId("testcase-selector");
    selector.innerHTML = "";
    for (let i = 1; i <= total; i++) {
        let label = i.toString();
        if (i <= samples) {
            label += " (sample)";
        }
        selector.appendChild(new Option(label, i.toString()));
    }
    // fill editors
    onSelectTestcase();
}

function onSelectTestcase() {
    const selector = getId(`testcase-selector`);
    const inputTestcaseEditor = getId(`input-testcase-editor`);
    const outputTestcaseEditor = getId(`output-testcase-editor`);

    const idx = parseInt(selector.value);
    inputTestcaseEditor.value = inputTestcases[idx-1] || "";
    outputTestcaseEditor.value = outputTestcases[idx-1] || "";
}

function saveTestcase() {
    const selector = getId(`testcase-selector`);
    const inputTestcaseEditor = getId(`input-testcase-editor`);
    const outputTestcaseEditor = getId(`output-testcase-editor`);

    const idx = parseInt(selector.value);
    inputTestcases[idx-1] = inputTestcaseEditor.value;
    outputTestcases[idx-1] = outputTestcaseEditor.value;
}

function loadTestcaseFromFile(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (e) => {
        const content = e.target.result;
        document.getElementById(`${type}-testcase-editor`).value = content;
        saveTestcase();
    };
}

async function submitProblem(event) {
    event.preventDefault();

    const id = getId("id").value.trim();
    const name = getId("name").value.trim();
    const problemStatement = problemStatementContainer.root.innerHTML;
    const inputFormat = inputFormatContainer.root.innerHTML;
    const outputFormat = outputFormatContainer.root.innerHTML;
    const numTestcases = parseInt(getId("num-testcases").value.trim());
    const numSampleTestcases = parseInt(getId("num-sample-testcases").value.trim());
    // const contestID = $("contest-id").value.trim() || null;
    const contestID = null;

    inputTestcases.length = numTestcases;
    outputTestcases.length = numTestcases;
    inputTestcases.map(value => value || "");
    outputTestcases.map(value => value || "");

    const problem = {
        id,
        name,
        problemStatement,
        inputFormat,
        outputFormat,
        numSampleTestcases,
        inputTestcases,
        outputTestcases,
        contestID
    };

    // console.log(problem);

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`/admin/save-problem`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(problem)
        });

        if (!res.ok) throw new Error("Save failed");
        alert("Problem saved successfully!");
    } catch (err) {
        alert("Error: " + err.message);
    }
}