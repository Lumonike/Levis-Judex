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

// Inject SunEditor CSS
const sunEditorCSS = document.createElement("link");
sunEditorCSS.rel = "stylesheet";
sunEditorCSS.href = "https://cdn.jsdelivr.net/npm/suneditor@2.47.8/dist/css/suneditor.min.css";
document.head.appendChild(sunEditorCSS);

// Inject SunEditor script
const sunEditorScript = document.createElement("script");
sunEditorScript.src = "https://cdn.jsdelivr.net/npm/suneditor@2.47.8/dist/suneditor.min.js";
document.head.appendChild(sunEditorScript);

const katexCSS = document.createElement("link");
katexCSS.rel = "stylesheet";
katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css";
document.head.appendChild(katexCSS);

const katexScript = document.createElement("script");
katexScript.src = "https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.js";
document.head.appendChild(katexScript);

sunEditorScript.onload = () => {
    const interval = setInterval(() => {
        if (getId("problem-statement") && getId("input-format") && getId("output-format")) {
            clearInterval(interval);

            const editorIds = ["problem-statement", "input-format", "output-format"];
            editorIds.forEach((id) => {
                const editor = SUNEDITOR.create(getId(id), {
                    buttonList: [
                        ["bold", "italic", "underline", "strike"],
                        ["list"],
                        ["subscript", "superscript"],
                        ["link", "math"],
                        ["lessEqual", "greaterEqual"],
                    ],
                    plugins: [
                        {
                            name: "lessEqual",
                            display: "command",
                            title: "Insert ≤",
                            buttonClass: "",
                            innerHTML: '<span style="font-size: 18px;">≤</span>',
                            add: function (core, targetElement) {},
                            action: function () {
                                editor.insertHTML("≤");
                            },
                        },
                        {
                            name: "greaterEqual",
                            display: "command",
                            title: "Insert ≥",
                            buttonClass: "",
                            innerHTML: '<span style="font-size: 18px;">≥</span>',
                            add: function (core, targetElement) {},
                            action: function () {
                                editor.insertHTML("≥");
                            },
                        },
                    ],
                    katex: katex,
                });

                window[id + "Container"] = editor;
            });

            setupEventListeners();
        }
    }, 100);
};

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
    if (!confirm("Are you sure you want to delete this problem?")) return;
    const id = getId("problem-id-search").value.trim();
    if (!id) return alert("Please enter a problem ID.");
    try {
        const res = await fetch(`/api/admin/delete-problem?id=${id}`, { method: "DELETE" });
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

    window["problem-statementContainer"].setContents(data.problemStatement || "");
    window["input-formatContainer"].setContents(data.inputFormat || "");
    window["output-formatContainer"].setContents(data.outputFormat || "");

    getId("num-testcases").value = data.inputTestcases.length;
    getId("num-sample-testcases").value = data.numSampleTestcases;

    const privateCheckbox = getId("private-checkbox");
    privateCheckbox.checked = data.isPrivate;
    const whitelistLabel = getId("whitelist-label");
    const whitelist = getId("whitelist");
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

    fillDropdown();
}

function fillDropdown() {
    const total = parseInt(getId("num-testcases").value);
    const samples = parseInt(getId("num-sample-testcases").value);
    const selector = getId("testcase-selector");
    selector.innerHTML = "";
    for (let i = 1; i <= total; i++) {
        let label = i.toString();
        if (i <= samples) label += " (sample)";
        selector.appendChild(new Option(label, i.toString()));
    }
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
        getId(`${type}-testcase-editor`).value = e.target.result;
        saveTestcase();
    };
}

function toggleWhitelist() {
    const whitelistLabel = getId("whitelist-label");
    const whitelist = getId("whitelist");
    if (!whitelistLabel || !whitelist) return;

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
    const problemStatement = window["problem-statementContainer"].getContents();
    const inputFormat = window["input-formatContainer"].getContents();
    const outputFormat = window["output-formatContainer"].getContents();
    const numTestcases = parseInt(getId("num-testcases").value.trim());
    const numSampleTestcases = parseInt(getId("num-sample-testcases").value.trim());
    const isPrivate = getId("private-checkbox").checked;
    const whitelist = isPrivate
        ? getId("whitelist")
              .value.replace(" ", "")
              .split(",")
              .filter((v) => v != "")
        : [];
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

    try {
        const res = await fetch(`/api/admin/save-problem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(problem),
        });
        if (!res.ok) throw new Error("Save failed");
        alert("Problem saved successfully!");
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function setupEventListeners() {
    const loadProblemButton = getId("load-problem-button");
    if (loadProblemButton) loadProblemButton.addEventListener("click", loadProblem);

    const deleteProblemButton = getId("delete-problem-button");
    if (deleteProblemButton) deleteProblemButton.addEventListener("click", deleteProblem);

    const problemForm = getId("problem-form");
    if (problemForm) problemForm.addEventListener("submit", submitProblem);

    const numTestcases = getId("num-testcases");
    const numSampleTestcases = getId("num-sample-testcases");
    if (numTestcases) numTestcases.addEventListener("change", fillDropdown);
    if (numSampleTestcases) numSampleTestcases.addEventListener("change", fillDropdown);

    const testcaseSelector = getId("testcase-selector");
    if (testcaseSelector) testcaseSelector.addEventListener("change", onSelectTestcase);

    const inputTestcaseEditor = getId("input-testcase-editor");
    const outputTestcaseEditor = getId("output-testcase-editor");
    if (inputTestcaseEditor) inputTestcaseEditor.addEventListener("change", saveTestcase);
    if (outputTestcaseEditor) outputTestcaseEditor.addEventListener("change", saveTestcase);

    const inputFileUpload = getId("input-file-upload");
    const outputFileUpload = getId("output-file-upload");
    if (inputFileUpload) inputFileUpload.addEventListener("change", (event) => loadTestcaseFromFile(event, "input"));
    if (outputFileUpload) outputFileUpload.addEventListener("change", (event) => loadTestcaseFromFile(event, "output"));

    const privateCheckbox = getId("private-checkbox");
    if (privateCheckbox) {
        if (privateCheckbox.checked) toggleWhitelist();
        privateCheckbox.addEventListener("click", toggleWhitelist);
    }
}
