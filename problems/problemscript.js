import { submitCode } from "/problems/submit.js";
import { fetchLastCode, displayPastResults } from "/problems/loadData.js";

const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

const problem = window.location.pathname;
console.log(problem);
// set up listener for run button
document.getElementById("submitButton").onclick = () => {submitCode(editor.getValue(), problem) };
fetchLastCode(problem, editor);
displayPastResults(problem);
