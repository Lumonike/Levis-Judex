import { submitCode } from "/problems/submit.js";


const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

// set up listener for run button
const problem = window.location.pathname;
console.log([editor.getValue(), problem, testcaseCount])
document.getElementById("submitButton").onclick = () => {submitCode(editor.getValue(), problem, testcaseCount) };
