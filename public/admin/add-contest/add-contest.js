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
const editorConfig = window.contestEditorConfig ?? {};
let availableClubs = [];
let activeProblemIndex = null;
let draggedProblemIndex = null;
const inlineEditors = new Map();
const inlineProblems = [];
const editorReady = loadRichEditorAssets();

function addInlineProblem(problem = {}) {
    syncInlineProblemsFromDom();
    saveOpenProblemEditor();
    const testcaseCount = Math.max(problem.inputTestcases?.length ?? 0, problem.outputTestcases?.length ?? 0, 1);
    const inputTestcases = normalizeTestcaseArray(problem.inputTestcases ?? [""], testcaseCount);
    const outputTestcases = normalizeTestcaseArray(problem.outputTestcases ?? [""], testcaseCount);
    inlineProblems.push({
        id: problem.id ?? "",
        inputFormat: problem.inputFormat ?? "",
        inputTestcases,
        name: problem.name ?? "",
        numSampleTestcases: clampNumber(problem.numSampleTestcases ?? 1, 0, inputTestcases.length),
        outputFormat: problem.outputFormat ?? "",
        outputTestcases,
        points: normalizePoints(problem.points ?? 100),
        problemStatement: problem.problemStatement ?? "",
    });
    renderInlineProblems();
    return inlineProblems.length - 1;
}

function createRichEditor(index, field, height) {
    const key = editorKey(index, field);
    const target = getId(editorElementId(index, field));
    if (!target || inlineEditors.has(key)) return;

    const editor = window.SUNEDITOR.create(target, {
        attributesWhitelist: {
            span: "style|contenteditable|data-exp|data-font-size",
        },
        buttonList: [["bold", "italic", "underline", "strike"], ["list"], ["link", "math"], ["removeFormat", "codeView"]],
        height,
        katex: window.katex,
    });
    editor.setContents(inlineProblems[index]?.[field] ?? "");
    inlineEditors.set(key, editor);
}

function destroyInlineEditors() {
    for (const editor of inlineEditors.values()) {
        editor.destroy?.();
    }
    inlineEditors.clear();
}

function editorElementId(index, field) {
    return `inline-${index.toString()}-${field}`;
}

function editorKey(index, field) {
    return `${index.toString()}:${field}`;
}

function escapeAttr(value) {
    return escapeText(value).replaceAll('"', "&quot;");
}

function escapeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function fromDateInput(value) {
    return new Date(value).toISOString();
}

function getInlineEditorContent(index, field) {
    return inlineEditors.get(editorKey(index, field))?.getContents() ?? "";
}

async function initializeProblemModalEditors(index) {
    await editorReady;
    createRichEditor(index, "problemStatement", 220);
    createRichEditor(index, "inputFormat", 120);
    createRichEditor(index, "outputFormat", 120);
}

async function loadContest() {
    const id = getId("contest-id-search").value.trim();
    if (!id) return alert("Please enter a contest ID.");

    try {
        const res = await fetch(editorUrl(editorConfig.getContestUrl ?? "/api/admin/get-contest?id={id}", id));
        const parsed = await res.json();
        if (!res.ok) {
            throw new Error(parsed.message ?? "Contest not found");
        }

        const contest = parsed.contest;
        const problemPoints = contest.problemPoints ?? {};
        getId("id").value = contest.id;
        getId("name").value = contest.name;
        getId("access-type").value = contest.accessType ?? "public";
        getId("club-id").value = contest.clubId ?? "";
        getId("timing-mode").value = contest.timingMode ?? "global";
        getId("duration-minutes").value = contest.durationMinutes ?? 240;
        setDateInput("start-time", contest.startTime);
        setDateInput("end-time", contest.endTime);
        toggleDuration();
        toggleClubAccess();

        inlineProblems.splice(
            0,
            inlineProblems.length,
            ...(contest.problems ?? []).map((problem) => ({
                ...problem,
                points: normalizePoints(problemPoints[problem.id] ?? problem.points ?? 100),
            })),
        );
        activeProblemIndex = null;
        destroyInlineEditors();
        getId("contest-problem-dialog").close();
        renderInlineProblems();
    } catch (err) {
        alert("Failed to load contest: " + err.message);
    }
}

async function loadClubs() {
    const res = await fetch(editorConfig.clubsUrl ?? "/api/admin/list-clubs");
    const parsed = await res.json();
    if (!res.ok) {
        availableClubs = [];
        renderClubOptions();
        return;
    }

    availableClubs = parsed.clubs ?? [];
    renderClubOptions();
    applyLockedClub();
}

async function loadExistingProblemAsInline() {
    const id = getId("existing-problem-id").value.trim();
    if (!id) return alert("Please enter a problem ID to load.");

    try {
        const res = await fetch(`/api/admin/get-public-problem?id=${encodeURIComponent(id)}`);
        const problem = await res.json();
        if (!res.ok) {
            throw new Error(problem.message ?? "Problem not found");
        }

        const index = addInlineProblem(problem);
        getId("existing-problem-id").value = "";
        openProblemEditor(index);
    } catch (err) {
        alert("Failed to load problem: " + err.message);
    }
}

function loadRichEditorAssets() {
    const sunEditorCSS = document.createElement("link");
    sunEditorCSS.rel = "stylesheet";
    sunEditorCSS.href = "https://cdn.jsdelivr.net/npm/suneditor@2.47.8/dist/css/suneditor.min.css";
    document.head.appendChild(sunEditorCSS);

    const katexCSS = document.createElement("link");
    katexCSS.rel = "stylesheet";
    katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css";
    document.head.appendChild(katexCSS);

    return Promise.all([
        loadScript("https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.js"),
        loadScript("https://cdn.jsdelivr.net/npm/suneditor@2.47.8/dist/suneditor.min.js"),
    ]);
}

function renderClubOptions() {
    const select = getId("club-id");
    select.innerHTML = "";
    if (availableClubs.length === 0) {
        select.appendChild(new Option("Create a class/club first", ""));
        return;
    }

    availableClubs.forEach((club) => {
        select.appendChild(new Option(club.name, club.id));
    });
    applyLockedClub();
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
        script.addEventListener("load", resolve);
        script.src = src;
        document.head.appendChild(script);
    });
}

function normalizePoints(value) {
    const points = Number(value);
    return Number.isFinite(points) && points > 0 ? points : 100;
}

function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return min;
    }
    return Math.min(Math.max(Math.floor(parsed), min), max);
}

function normalizeTestcaseArray(testcases, total) {
    const normalized = Array.isArray(testcases) ? [...testcases] : [];
    normalized.length = total;
    return normalized.map((testcase) => testcase ?? "");
}

function normalizeTestcaseCount(value, fallback = 1) {
    return clampNumber(value, 1, 50) || fallback;
}

function numberInputMarkup(field, label, value, min) {
    return `
        <div>
            <label class="text-lg font-semibold text-white mb-2 block">${label}</label>
            <input type="number" min="${min}" data-field="${field}" value="${escapeAttr(value)}" class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500">
        </div>
    `;
}

function readInlineProblemFromEditor(index) {
    const container = getId("contest-problem-editor");
    saveInlineTestcase(container);
    const totalTestcases = normalizeTestcaseCount(container.querySelector("[data-field='numTestcases']").value);
    const inputTestcases = normalizeTestcaseArray(inlineProblems[index]?.inputTestcases ?? [], totalTestcases);
    const outputTestcases = normalizeTestcaseArray(inlineProblems[index]?.outputTestcases ?? [], totalTestcases);

    return {
        id: container.querySelector("[data-field='id']").value.trim(),
        inputFormat: getInlineEditorContent(index, "inputFormat"),
        inputTestcases,
        name: container.querySelector("[data-field='name']").value.trim(),
        numSampleTestcases: clampNumber(container.querySelector("[data-field='numSampleTestcases']").value, 0, totalTestcases),
        outputFormat: getInlineEditorContent(index, "outputFormat"),
        outputTestcases,
        points: normalizePoints(container.querySelector("[data-field='points']").value),
        problemStatement: getInlineEditorContent(index, "problemStatement"),
    };
}

function renderInlineProblems() {
    const container = getId("inline-problems");
    container.innerHTML = "";

    if (inlineProblems.length === 0) {
        container.innerHTML = `<p class="section-note">No problems yet. Create one or load a public problem from the bank.</p>`;
        return;
    }

    inlineProblems.forEach((problem, index) => {
        const row = document.createElement("article");
        row.className = "contest-problem-row";
        row.draggable = true;
        row.dataset.inlineIndex = index.toString();
        row.innerHTML = `
            <div class="contest-problem-number">${(index + 1).toString()}</div>
            <div class="contest-problem-summary">
                <p>${escapeText(problem.name || "Untitled problem")}</p>
                <span>ID: ${escapeText(problem.id || "not set")}</span>
            </div>
            <div class="contest-problem-points">
                <label for="inline-${index.toString()}-points">Points</label>
                <input id="inline-${index.toString()}-points" type="number" min="1" data-field="points" value="${escapeAttr(problem.points)}">
            </div>
            <div class="contest-problem-actions">
                <button type="button" data-action="edit" class="btn btn-secondary">Edit</button>
                <button type="button" data-action="remove" class="btn btn-danger">Remove</button>
            </div>
        `;
        row.addEventListener("dragstart", () => {
            draggedProblemIndex = index;
            row.classList.add("dragging");
        });
        row.addEventListener("dragend", () => {
            draggedProblemIndex = null;
            row.classList.remove("dragging");
        });
        row.addEventListener("dragover", (event) => {
            event.preventDefault();
        });
        row.addEventListener("drop", (event) => {
            event.preventDefault();
            moveProblem(draggedProblemIndex, index);
        });
        row.querySelector("[data-field='points']").addEventListener("change", () => {
            inlineProblems[index].points = normalizePoints(row.querySelector("[data-field='points']").value);
            row.querySelector("[data-field='points']").value = inlineProblems[index].points.toString();
        });
        row.querySelector("[data-action='edit']").addEventListener("click", () => openProblemEditor(index));
        row.querySelector("[data-action='remove']").addEventListener("click", () => {
            syncInlineProblemsFromDom();
            inlineProblems.splice(index, 1);
            if (activeProblemIndex === index) {
                closeProblemEditor();
            } else if (activeProblemIndex !== null && activeProblemIndex > index) {
                activeProblemIndex--;
            }
            renderInlineProblems();
        });
        container.appendChild(row);
    });
}

function closeProblemEditor() {
    destroyInlineEditors();
    activeProblemIndex = null;
    getId("contest-problem-editor").innerHTML = "";
    const dialog = getId("contest-problem-dialog");
    if (dialog.open) {
        dialog.close();
    }
}

function moveProblem(fromIndex, toIndex) {
    if (fromIndex === null || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    syncInlineProblemsFromDom();
    const [problem] = inlineProblems.splice(fromIndex, 1);
    inlineProblems.splice(toIndex, 0, problem);
    renderInlineProblems();
}

function openProblemEditor(index) {
    syncInlineProblemsFromDom();
    if (activeProblemIndex !== null) {
        saveOpenProblemEditor(false);
    }

    activeProblemIndex = index;
    const problem = inlineProblems[index];
    const editor = getId("contest-problem-editor");
    destroyInlineEditors();
    getId("contest-problem-dialog-title").textContent = `Edit problem ${(index + 1).toString()}`;
    editor.dataset.inlineIndex = index.toString();
    editor.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${inputMarkup("id", "Problem ID", problem.id)}
                ${inputMarkup("name", "Problem Name", problem.name)}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${numberInputMarkup("points", "Points", problem.points, 1)}
            </div>
            ${richEditorMarkup(index, "problemStatement", "Problem Statement")}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${richEditorMarkup(index, "inputFormat", "Input Format")}
                ${richEditorMarkup(index, "outputFormat", "Output Format")}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${numberInputMarkup("numTestcases", "Total Testcases", problem.inputTestcases.length, 1)}
                ${numberInputMarkup("numSampleTestcases", "Sample Testcases", problem.numSampleTestcases, 0)}
            </div>
            ${testcaseEditorMarkup(index)}
        </div>
    `;
    editor.querySelector("[data-field='numTestcases']").addEventListener("change", () => resizeInlineTestcases(editor));
    editor.querySelector("[data-field='numSampleTestcases']").addEventListener("change", () => {
        saveInlineTestcase(editor);
        clampInlineSampleCount(editor);
        fillInlineTestcaseSelector(editor);
    });
    editor.querySelector("[data-field='testcaseSelector']").addEventListener("change", () => loadSelectedInlineTestcase(editor));
    editor.querySelector("[data-field='inputTestcaseEditor']").addEventListener("change", () => saveInlineTestcase(editor));
    editor.querySelector("[data-field='outputTestcaseEditor']").addEventListener("change", () => saveInlineTestcase(editor));
    editor.querySelector("[data-field='inputFileUpload']").addEventListener("change", (event) => loadInlineTestcaseFromFile(event, editor, "input"));
    editor
        .querySelector("[data-field='outputFileUpload']")
        .addEventListener("change", (event) => loadInlineTestcaseFromFile(event, editor, "output"));
    fillInlineTestcaseSelector(editor);

    const dialog = getId("contest-problem-dialog");
    if (!dialog.open) {
        dialog.showModal();
    }
    void initializeProblemModalEditors(index);
}

function saveOpenProblemEditor(shouldRender = true) {
    if (activeProblemIndex === null || !getId("contest-problem-editor").dataset.inlineIndex) return;

    inlineProblems[activeProblemIndex] = readInlineProblemFromEditor(activeProblemIndex);
    if (shouldRender) {
        renderInlineProblems();
    }
}

function richEditorMarkup(index, field, label) {
    return `
        <div>
            <label class="text-lg font-semibold text-white mb-2 block">${label}</label>
            <div id="${editorElementId(index, field)}" data-field="${field}" class="bg-white rounded-lg text-gray-900"></div>
        </div>
    `;
}

function setDateInput(id, dateString) {
    const date = new Date(dateString);
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    getId(id).value = offsetDate.toISOString().slice(0, 16);
}

function setupEventListeners() {
    getId("timing-mode").addEventListener("change", toggleDuration);
    getId("access-type").addEventListener("change", toggleClubAccess);
    getId("load-existing-problem-button").addEventListener("click", loadExistingProblemAsInline);
    getId("add-inline-problem-button").addEventListener("click", () => openProblemEditor(addInlineProblem()));
    getId("load-contest-button").addEventListener("click", loadContest);
    getId("contest-form").addEventListener("submit", submitContest);
    setupProblemDialog();
}

function editorUrl(template, id) {
    const url = template.includes("{id}") ? template.replace("{id}", encodeURIComponent(id)) : `${template}${encodeURIComponent(id)}`;
    const clubId = editorConfig.lockedClubId || (getId("access-type").value === "club" ? getId("club-id").value : "");
    if (!clubId) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}club=${encodeURIComponent(clubId)}`;
}

function applyLockedClub() {
    if (!editorConfig.lockedClubId) return;

    getId("access-type").value = editorConfig.lockedAccessType ?? "club";
    getId("access-type").disabled = true;
    const clubSelect = getId("club-id");
    if (![...clubSelect.options].some((option) => option.value === editorConfig.lockedClubId)) {
        clubSelect.appendChild(new Option(editorConfig.lockedClubId, editorConfig.lockedClubId));
    }
    clubSelect.value = editorConfig.lockedClubId;
    clubSelect.disabled = true;
    toggleClubAccess();
}

function resizeInlineTestcases(section) {
    saveInlineTestcase(section);
    const totalInput = section.querySelector("[data-field='numTestcases']");
    const total = normalizeTestcaseCount(totalInput.value);
    totalInput.value = total.toString();

    const index = getInlineIndex(section);
    inlineProblems[index].inputTestcases = normalizeTestcaseArray(inlineProblems[index].inputTestcases, total);
    inlineProblems[index].outputTestcases = normalizeTestcaseArray(inlineProblems[index].outputTestcases, total);
    clampInlineSampleCount(section);
    fillInlineTestcaseSelector(section);
}

function clampInlineSampleCount(section) {
    const total = normalizeTestcaseCount(section.querySelector("[data-field='numTestcases']").value);
    const sampleInput = section.querySelector("[data-field='numSampleTestcases']");
    sampleInput.max = total.toString();
    sampleInput.value = clampNumber(sampleInput.value, 0, total).toString();
}

function fillInlineTestcaseSelector(section) {
    const index = getInlineIndex(section);
    const total = normalizeTestcaseCount(section.querySelector("[data-field='numTestcases']").value);
    const samples = clampNumber(section.querySelector("[data-field='numSampleTestcases']").value, 0, total);
    const selector = section.querySelector("[data-field='testcaseSelector']");
    const previousValue = selector.value;

    inlineProblems[index].inputTestcases = normalizeTestcaseArray(inlineProblems[index].inputTestcases, total);
    inlineProblems[index].outputTestcases = normalizeTestcaseArray(inlineProblems[index].outputTestcases, total);
    selector.innerHTML = "";
    for (let i = 1; i <= total; i++) {
        let label = i.toString();
        if (i <= samples) label += " (sample)";
        selector.appendChild(new Option(label, i.toString()));
    }
    selector.value = previousValue && Number(previousValue) <= total ? previousValue : "1";
    loadSelectedInlineTestcase(section);
}

function getInlineIndex(section) {
    return Number(section.dataset.inlineIndex);
}

function loadInlineTestcaseFromFile(event, section, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (e) => {
        section.querySelector(`[data-field='${type}TestcaseEditor']`).value = e.target.result;
        saveInlineTestcase(section);
    };
}

function loadSelectedInlineTestcase(section) {
    const index = getInlineIndex(section);
    const selector = section.querySelector("[data-field='testcaseSelector']");
    const testcaseIndex = Number(selector.value) - 1;
    section.querySelector("[data-field='inputTestcaseEditor']").value = inlineProblems[index].inputTestcases[testcaseIndex] ?? "";
    section.querySelector("[data-field='outputTestcaseEditor']").value = inlineProblems[index].outputTestcases[testcaseIndex] ?? "";
}

function saveInlineTestcase(section) {
    if (!section) return;

    const index = getInlineIndex(section);
    const selector = section.querySelector("[data-field='testcaseSelector']");
    if (!selector?.value) return;

    const testcaseIndex = Number(selector.value) - 1;
    inlineProblems[index].inputTestcases[testcaseIndex] = section.querySelector("[data-field='inputTestcaseEditor']").value;
    inlineProblems[index].outputTestcases[testcaseIndex] = section.querySelector("[data-field='outputTestcaseEditor']").value;
}

async function submitContest(event) {
    event.preventDefault();
    syncInlineProblemsFromDom();
    saveOpenProblemEditor();

    const timingMode = getId("timing-mode").value;
    const contest = {
        durationMinutes: timingMode === "personal" ? Number(getId("duration-minutes").value) : undefined,
        accessType: getId("access-type").value,
        clubId: getId("access-type").value === "club" ? getId("club-id").value : null,
        endTime: fromDateInput(getId("end-time").value),
        existingProblemIds: [],
        id: getId("id").value.trim(),
        inlineProblems,
        name: getId("name").value.trim(),
        problemPoints: Object.fromEntries(inlineProblems.map((problem) => [problem.id, problem.points])),
        startTime: fromDateInput(getId("start-time").value),
        timingMode,
    };

    try {
        const res = await fetch(editorConfig.saveUrl ?? "/api/admin/save-contest", {
            body: JSON.stringify(contest),
            headers: { "Content-Type": "application/json" },
            method: "POST",
        });
        const parsed = await res.json();
        if (!res.ok) {
            throw new Error(parsed.message ?? "Save failed");
        }
        alert(parsed.message);
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function syncInlineProblemsFromDom() {
    document.querySelectorAll("#inline-problems [data-inline-index]").forEach((row) => {
        const index = Number(row.dataset.inlineIndex);
        inlineProblems[index].points = normalizePoints(row.querySelector("[data-field='points']").value);
    });
}

function setupProblemDialog() {
    const dialog = getId("contest-problem-dialog");
    const close = getId("contest-problem-dialog-close");
    const save = getId("contest-problem-dialog-save");

    close.addEventListener("click", () => {
        saveOpenProblemEditor();
        closeProblemEditor();
    });
    save.addEventListener("click", () => {
        saveOpenProblemEditor();
        closeProblemEditor();
    });
    dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        saveOpenProblemEditor();
        closeProblemEditor();
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            saveOpenProblemEditor();
            closeProblemEditor();
        }
    });
}

function testcaseEditorMarkup(index) {
    return `
        <div class="border-t pt-4" style="border-color: var(--line)">
            <label class="text-lg font-semibold text-white mb-2 block">Testcase Editor</label>
            <select data-field="testcaseSelector"
                class="w-full p-3 mb-4 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500">
            </select>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-3">
                    <label for="inline-${index.toString()}-input-testcase">Input</label>
                    <textarea id="inline-${index.toString()}-input-testcase" data-field="inputTestcaseEditor" rows="7"
                        class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 border border-gray-500 font-mono"></textarea>
                    <input type="file" data-field="inputFileUpload"
                        class="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>

                <div class="space-y-3">
                    <label for="inline-${index.toString()}-output-testcase">Output</label>
                    <textarea id="inline-${index.toString()}-output-testcase" data-field="outputTestcaseEditor" rows="7"
                        class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500 font-mono"></textarea>
                    <input type="file" data-field="outputFileUpload"
                        class="text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
            </div>
        </div>
    `;
}

function toggleDuration() {
    getId("duration-wrapper").classList.toggle("hidden", getId("timing-mode").value !== "personal");
}

function toggleClubAccess() {
    getId("club-wrapper").classList.toggle("hidden", getId("access-type").value !== "club");
}

function inputMarkup(field, label, value) {
    return `
        <div>
            <label class="text-lg font-semibold text-white mb-2 block">${label}</label>
            <input data-field="${field}" value="${escapeAttr(value)}" class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500">
        </div>
    `;
}

setupEventListeners();
toggleDuration();
toggleClubAccess();
applyLockedClub();
void initializePage();

async function initializePage() {
    await loadClubs();
    if (editorConfig.initialContestId) {
        getId("contest-id-search").value = editorConfig.initialContestId;
        await loadContest();
    }
}
