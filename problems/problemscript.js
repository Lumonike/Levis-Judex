import { submitCode } from "/problems/submit.js";
import { fetchLastCode, displayPastResults } from "/problems/loadData.js";

const editor = ace.edit("editor");
editor.setTheme('ace/theme/monokai');
editor.session.setMode('ace/mode/python');

const url = window.location.pathname.split("/");
let contestID = null;
if (url.at(-3) == "contests") {
    contestID = url.at(-2);
}
const problemID = url.at(-1);
console.log(contestID);
console.log(problemID);
// set up listener for run button
document.getElementById("submitButton").onclick = () => { submitCode(editor.getValue(), problemID, contestID) };
fetchLastCode(problemID, contestID, editor);
displayPastResults(problemID, contestID);
