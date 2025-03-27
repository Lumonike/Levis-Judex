import { submitCode } from "/problems/submit.js";
import { displayPastResults } from "./loadResults.js";

const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

const problem = window.location.pathname;
// set up listener for run button
document.getElementById("submitButton").onclick = () => {submitCode(editor.getValue(), problem) };
displayPastResults(problem);
