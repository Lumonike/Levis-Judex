const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

module.exports.createProblemHtml = (problem) => {
    const { document } = new JSDOM(fs.readFileSync(path.join(__dirname, "..", "templates", "base.html"))).window;

    document.head.innerHTML += `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
    <script type="module" src="/problems/problemscript.js" defer></script>
    <link rel="stylesheet" href="/problems/problemstyle.css"></link>`

    document.title = problem.name;

    document.body.innerHTML = `<header class="p-4">
        <a href="/problems" class="text-blue-400 hover:underline">← Back to Problem List</a>
    </header>` + document.body.innerHTML;

    const mainSection = document.getElementById("main-section");
    mainSection.className = mainSection.className.replace("text-center", "");
    mainSection.className = mainSection.className.replace("relative", "");
    mainSection.innerHTML = fs.readFileSync(path.join(__dirname, "..", "templates", "partials", "problem.html"));
    document.getElementById("problemName").innerHTML = problem.name;
    document.getElementById("problemStatement").innerHTML = problem.problemStatement;
    document.getElementById("inputFormat").innerHTML = problem.inputFormat;
    document.getElementById("outputFormat").innerHTML = problem.outputFormat;
    for (let i = 0; i < problem.numSampleTestcases; i++) {
        const problemSection = document.getElementById("problem-section");
        // prevent big space between format and samples but keep big space between samples
        if (i > 0) {
            problemSection.innerHTML += `<br><br>`;
        }
        problemSection.innerHTML += `<h4 class="font-bold">SAMPLE INPUT:</h4>`;
        const sampleInput = problem.inputTestcases[i].split("\n");
        for (const line of sampleInput) {
            problemSection.innerHTML += `<span>${line}</span><br>`;
        }
        problemSection.innerHTML += `<h4 class="font-bold">SAMPLE OUTPUT:</h4>`;
        const sampleOutput = problem.outputTestcases[i].split("\n");
        for (const line of sampleOutput) {
            problemSection.innerHTML += `<span>${line}</span>`;
        }
    }

    return document.documentElement.outerHTML;
}
