import { submitCode } from "/problems/submit.js";


const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

// set up listener for run button
const problem = window.location.pathname.slice("/problems/".length, window.location.pathname.length-1);
document.getElementById("submitButton").onclick = () => {submitCode(editor.getValue(), problem, testcaseCount) };
