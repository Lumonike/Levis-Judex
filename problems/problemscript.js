import { submitCode } from "/problems/submit.js";
import { fetchLastCode, displayPastResults } from "/problems/loadData.js";

const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

const params = new URLSearchParams(window.location.search);
const problemID = params.get("id");
console.log(problemID);
// set up listener for run button
document.getElementById("submitButton").onclick = () => { submitCode(editor.getValue(), problemID) };
fetchLastCode(problemID, editor);
displayPastResults(problemID);
