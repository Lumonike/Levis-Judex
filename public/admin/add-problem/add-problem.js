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
    ["bold", "italic", "underline", "strike"],
    ["link"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ script: "sub" }, { script: "super" }],
];

const quillCSS = document.createElement("link");
quillCSS.rel = "stylesheet";
quillCSS.href = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
document.head.appendChild(quillCSS);
const quillScript = document.createElement("script");
quillScript.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
document.head.appendChild(quillScript);
quillScript.onload = () => {
    // ensure all of that is loaded
    const interval = setInterval(() => {
        if (getId("problem-statement") && getId("input-format") && getId("output-format")) {
            clearInterval(interval);
            window.problemStatementContainer = new Quill("#problem-statement", { modules: { toolbar: toolbarOptions }, theme: "snow" });
            window.inputFormatContainer = new Quill("#input-format", { modules: { toolbar: toolbarOptions }, theme: "snow" });
            window.outputFormatContainer = new Quill("#output-format", { modules: { toolbar: toolbarOptions }, theme: "snow" });
            addSymbolButtons();
            setupEventListeners();
        }
    }, 100);
};

function addSymbolButtons() {
    document.querySelectorAll(".ql-toolbar").forEach((toolbar) => {
        const container = toolbar.nextElementSibling;
        if (!container) return;

        const quill = Quill.find(container);
        if (!quill) return;

        // Create a new toolbar group to match Quill's format
        const formatGroup = document.createElement("span");
        formatGroup.className = "ql-formats";

        // Helper: create a symbol button
        function createSymbolButton(symbol) {
            const button = document.createElement("button");
            button.type = "button";
            button.innerHTML = `<span style="padding=0; font-size:20px; line-height:1;">${symbol}</span>`;

            // Use mousedown to preserve cursor/selection
            button.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const range = quill.getSelection(true);
                if (!range) return;
                quill.deleteText(range.index, range.length);
                quill.insertText(range.index, symbol, "user");
                quill.setSelection(range.index + 1, 0, "user");
            });

            return button;
        }

        formatGroup.appendChild(createSymbolButton("≤"));
        formatGroup.appendChild(createSymbolButton("≥"));

        toolbar.appendChild(formatGroup);
    });
}

async function loadProblem() {
    const id = getId("problem-id-search").value.trim();
    if (!id) return alert("Please enter a problem ID.");
    try {
        const res = await fetch(`/api/problems/get-problem?id=${id}`);
        if (!res.ok) throw new Error("Problem not found");
        const data = await res.json();
        populateForm(data);
    } catch (err) {
        alert("Failed to load problem: " + err.message);
    }
}

async function deleteProblem() {
    if (!confirm("Are you sure you want to delete this problem?")) {
        return;
    }
    const id = getId("problem-id-search").value.trim();
    if (!id) return alert("Please enter a problem ID.");
    try {
        const res = await fetch(`/api/admin/delete-problem?id=${id}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        alert("Successfully deleted problem");
    } catch (err) {
        alert("Failed to delete problem: " + err.message);
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
    const privateCheckbox = getId("private-checkbox");
    privateCheckbox.checked = data.isPrivate;
    const whitelistLabel = document.getElementById("whitelist-label");
    const whitelist = document.getElementById("whitelist");
    if (privateCheckbox.checked) {
        whitelist.classList.remove("hidden");
        whitelistLabel.classList.remove("hidden");
        whitelist.value = data.whitelist.join(", ");
    } else {
        whitelist.classList.add("hidden");
        whitelistLabel.classList.add("hidden");
        whitelist.value = "";
    }

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
    inputTestcaseEditor.value = inputTestcases[idx - 1] || "";
    outputTestcaseEditor.value = outputTestcases[idx - 1] || "";
}

function saveTestcase() {
    const selector = getId(`testcase-selector`);
    const inputTestcaseEditor = getId(`input-testcase-editor`);
    const outputTestcaseEditor = getId(`output-testcase-editor`);

    const idx = parseInt(selector.value);
    inputTestcases[idx - 1] = inputTestcaseEditor.value;
    outputTestcases[idx - 1] = outputTestcaseEditor.value;
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

function toggleWhitelist() {
    const whitelistLabel = document.getElementById("whitelist-label");
    const whitelist = document.getElementById("whitelist");

    if (!whitelistLabel || !whitelist) {
        return;
    }

    if (whitelist.className.indexOf("hidden") !== -1) {
        whitelist.classList.remove("hidden");
        whitelistLabel.classList.remove("hidden");
    } else {
        whitelist.classList.add("hidden");
        whitelistLabel.classList.add("hidden");
        whitelist.value = "";
    }
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
    const isPrivate = getId("private-checkbox").checked;
    const whitelist = isPrivate ? getId("whitelist").value.replace(" ", "").split(",") : [];
    const contestID = null;

    inputTestcases.length = numTestcases;
    outputTestcases.length = numTestcases;
    inputTestcases.map((value) => value || "");
    outputTestcases.map((value) => value || "");

    const problem = {
        id,
        name,
        problemStatement,
        inputFormat,
        outputFormat,
        numSampleTestcases,
        inputTestcases,
        outputTestcases,
        contestID,
        isPrivate,
        whitelist,
    };

    // console.log(problem);

    try {
        const res = await fetch(`/api/admin/save-problem`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(problem),
        });

        if (!res.ok) throw new Error("Save failed");
        alert("Problem saved successfully!");
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function setupEventListeners() {
    const loadProblemButton = document.getElementById("load-problem-button");
    if (loadProblemButton) {
        loadProblemButton.addEventListener("click", loadProblem);
    }

    const deleteProblemButton = document.getElementById("delete-problem-button");
    if (deleteProblemButton) {
        deleteProblemButton.addEventListener("click", deleteProblem);
    }

    const problemForm = document.getElementById("problem-form");
    if (problemForm) {
        problemForm.addEventListener("submit", submitProblem);
    }

    const numTestcases = document.getElementById("num-testcases");
    const numSampleTestcases = document.getElementById("num-sample-testcases");
    if (numTestcases) {
        numTestcases.addEventListener("change", fillDropdown);
    }
    if (numSampleTestcases) {
        numSampleTestcases.addEventListener("change", fillDropdown);
    }

    const testcaseSelector = document.getElementById("testcase-selector");
    if (testcaseSelector) {
        testcaseSelector.addEventListener("change", onSelectTestcase);
    }

    const inputTestcaseEditor = document.getElementById("input-testcase-editor");
    const outputTestcaseEditor = document.getElementById("output-testcase-editor");
    if (inputTestcaseEditor) {
        inputTestcaseEditor.addEventListener("change", saveTestcase);
    }
    if (outputTestcaseEditor) {
        outputTestcaseEditor.addEventListener("change", saveTestcase);
    }

    const inputFileUpload = document.getElementById("input-file-upload");
    const outputFileUpload = document.getElementById("output-file-upload");
    if (inputFileUpload) {
        inputFileUpload.addEventListener("change", (event) => loadTestcaseFromFile(event, "input"));
    }
    if (outputFileUpload) {
        outputFileUpload.addEventListener("change", (event) => loadTestcaseFromFile(event, "output"));
    }

    const privateCheckbox = document.getElementById("private-checkbox");
    if (privateCheckbox) {
        if (privateCheckbox.checked) {
            toggleWhitelist();
        }
        privateCheckbox.addEventListener("click", toggleWhitelist);
    }
}
