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
const existingProblems = [];
let availableClubs = [];
const inlineEditors = new Map();
const inlineProblems = [];
const editorReady = loadRichEditorAssets();

function addExistingProblem(problemID, points = 100) {
    const id = problemID.trim();
    if (!id || existingProblems.some((problem) => problem.id === id)) return;
    existingProblems.push({ id, points: normalizePoints(points) });
    renderExistingProblems();
}

function addInlineProblem(problem = {}) {
    syncInlineProblemsFromDom();
    inlineProblems.push({
        id: problem.id ?? "",
        inputFormat: problem.inputFormat ?? "",
        inputTestcases: problem.inputTestcases ?? [""],
        name: problem.name ?? "",
        numSampleTestcases: problem.numSampleTestcases ?? 1,
        outputFormat: problem.outputFormat ?? "",
        outputTestcases: problem.outputTestcases ?? [""],
        points: normalizePoints(problem.points ?? 100),
        problemStatement: problem.problemStatement ?? "",
    });
    renderInlineProblems();
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

async function initializeInlineEditors() {
    await editorReady;
    inlineProblems.forEach((_problem, index) => {
        createRichEditor(index, "problemStatement", 220);
        createRichEditor(index, "inputFormat", 120);
        createRichEditor(index, "outputFormat", 120);
    });
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

        existingProblems.splice(
            0,
            existingProblems.length,
            ...(contest.problemIds ?? []).map((problemId) => ({
                id: problemId,
                points: normalizePoints(problemPoints[problemId] ?? 100),
            })),
        );
        inlineProblems.splice(
            0,
            inlineProblems.length,
            ...(contest.problems ?? []).map((problem) => ({
                ...problem,
                points: normalizePoints(problemPoints[problem.id] ?? problem.points ?? 100),
            })),
        );
        renderExistingProblems();
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
        const res = await fetch(`/api/problems/get-problem?id=${encodeURIComponent(id)}`);
        const problem = await res.json();
        if (!res.ok) {
            throw new Error(problem.message ?? problem.error ?? "Problem not found");
        }

        addInlineProblem(problem);
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

function numberInputMarkup(field, label, value, min) {
    return `
        <div>
            <label class="text-lg font-semibold text-white mb-2 block">${label}</label>
            <input type="number" min="${min}" data-field="${field}" value="${escapeAttr(value)}" class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500">
        </div>
    `;
}

function readExistingProblem(index) {
    const container = document.querySelector(`[data-existing-index="${index}"]`);

    return {
        id: container.dataset.problemId,
        points: normalizePoints(container.querySelector("[data-field='points']").value),
    };
}

function readInlineProblem(index) {
    const container = document.querySelector(`[data-inline-index="${index}"]`);
    const inputTestcases = splitTestcases(container.querySelector("[data-field='inputTestcases']").value);
    const outputTestcases = splitTestcases(container.querySelector("[data-field='outputTestcases']").value);

    return {
        id: container.querySelector("[data-field='id']").value.trim(),
        inputFormat: getInlineEditorContent(index, "inputFormat"),
        inputTestcases,
        name: container.querySelector("[data-field='name']").value.trim(),
        numSampleTestcases: Number(container.querySelector("[data-field='numSampleTestcases']").value),
        outputFormat: getInlineEditorContent(index, "outputFormat"),
        outputTestcases,
        points: normalizePoints(container.querySelector("[data-field='points']").value),
        problemStatement: getInlineEditorContent(index, "problemStatement"),
    };
}

function renderExistingProblems() {
    const list = getId("existing-problem-list");
    list.innerHTML = "";

    existingProblems.forEach((problem, index) => {
        const item = document.createElement("div");
        item.className = "flex flex-col sm:flex-row sm:items-end gap-3 rounded-lg bg-gray-600 p-3 border border-gray-500";
        item.dataset.existingIndex = index.toString();
        item.dataset.problemId = problem.id;
        item.innerHTML = `
            <div class="flex-1 min-w-48">
                <p class="text-sm text-gray-300 mb-1">Problem ID</p>
                <p class="text-lg font-semibold text-white break-all">${escapeText(problem.id)}</p>
            </div>
            ${numberInputMarkup("points", "Points", problem.points, 1)}
            <button type="button" data-action="remove" class="btn btn-danger">
                Remove
            </button>
        `;
        item.querySelector("[data-action='remove']").addEventListener("click", () => {
            existingProblems.splice(index, 1);
            renderExistingProblems();
        });
        list.appendChild(item);
    });
}

function renderInlineProblems() {
    const container = getId("inline-problems");
    destroyInlineEditors();
    container.innerHTML = "";

    inlineProblems.forEach((problem, index) => {
        const section = document.createElement("section");
        section.className = "rounded-lg border border-gray-600 bg-gray-800 p-4 space-y-4";
        section.dataset.inlineIndex = index.toString();
        section.innerHTML = `
            <div class="flex items-center justify-between gap-4">
                <h3 class="text-xl font-bold text-white">Problem ${index + 1}</h3>
                <button type="button" data-action="remove" class="btn btn-danger">Remove</button>
            </div>
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
            <div>
                <label class="text-lg font-semibold text-white mb-2 block">Sample Testcases</label>
                <input type="number" min="0" data-field="numSampleTestcases" value="${problem.numSampleTestcases}"
                    class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${textareaMarkup("inputTestcases", "Input Testcases", problem.inputTestcases.join("\n---\n"), 7)}
                ${textareaMarkup("outputTestcases", "Output Testcases", problem.outputTestcases.join("\n---\n"), 7)}
            </div>
        `;
        section.querySelector("[data-action='remove']").addEventListener("click", () => {
            syncInlineProblemsFromDom();
            inlineProblems.splice(index, 1);
            renderInlineProblems();
        });
        container.appendChild(section);
    });

    void initializeInlineEditors();
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
    getId("add-existing-problem-button").addEventListener("click", () => {
        addExistingProblem(getId("existing-problem-id").value);
        getId("existing-problem-id").value = "";
    });
    getId("load-existing-problem-button").addEventListener("click", loadExistingProblemAsInline);
    getId("add-inline-problem-button").addEventListener("click", () => addInlineProblem());
    getId("load-contest-button").addEventListener("click", loadContest);
    getId("contest-form").addEventListener("submit", submitContest);
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

function splitTestcases(value) {
    return value.split(/\n---\n/g).map((testcase) => testcase.trimEnd());
}

async function submitContest(event) {
    event.preventDefault();
    for (let i = 0; i < existingProblems.length; i++) {
        existingProblems[i] = readExistingProblem(i);
    }
    syncInlineProblemsFromDom();

    const timingMode = getId("timing-mode").value;
    const contest = {
        durationMinutes: timingMode === "personal" ? Number(getId("duration-minutes").value) : undefined,
        accessType: getId("access-type").value,
        clubId: getId("access-type").value === "club" ? getId("club-id").value : null,
        endTime: fromDateInput(getId("end-time").value),
        existingProblemIds: existingProblems.map((problem) => problem.id),
        id: getId("id").value.trim(),
        inlineProblems,
        name: getId("name").value.trim(),
        problemPoints: Object.fromEntries([...existingProblems, ...inlineProblems].map((problem) => [problem.id, problem.points])),
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
    for (let i = 0; i < inlineProblems.length; i++) {
        if (document.querySelector(`[data-inline-index="${i}"]`)) {
            inlineProblems[i] = readInlineProblem(i);
        }
    }
}

function textareaMarkup(field, label, value, rows) {
    return `
        <div>
            <label class="text-lg font-semibold text-white mb-2 block">${label}</label>
            <textarea data-field="${field}" rows="${rows}" class="w-full text-lg p-3 rounded-lg bg-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-500 font-mono">${escapeText(value)}</textarea>
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
