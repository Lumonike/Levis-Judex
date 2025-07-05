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

/**
 * Module for judging code
 * @module judge
 */

/**
 * @typedef {Object} Result
 * @property {string} status AC, WA, TLE, etc.
 * @property {string} time How many seconds it took
 * @property {string} mem MB of space used
 * @memberof module:judge
 */

const fs = require("fs");
const { spawn } = require("child_process");
const models = require('./models.js')
const path = require("path");

let initializedIsolate = false;

/**
 * Number of isolate boxes
 * @private
 * @type {number}
 * @readonly
 * @memberof module:judge
 */
const numBoxes = 5;

/**
 * Maximum number of testcases a problem can have
 * @name maxTestcases
 * @type {number}
 * @readonly
 * @memberof module:judge
 */
module.exports.maxTestcases = 50;

/**
 * Paths of all the isolate boxes
 * @private
 * @type {string[]}
 * @memberof module:judge
 */
const boxPaths = new Array(numBoxes);

/**
 * Available isolate boxes
 * @private
 * @type {number[]}
 * @memberof module:judge
 */
const availableBoxes = new Array(numBoxes).fill(0).map((_, index) => index);

/**
 * @private
 * @type {Result[]}
 * @memberof module:judge
 */
const results = new Array(numBoxes).fill([]);

/**
 * Gets the ID of an available box
 * @name getBoxID
 * @function
 * @memberof module:judge
 * @returns {number} Available boxID, -1 if none available
 */
module.exports.getBoxID = () => {
    if (availableBoxes.length == 0) return -1;
    results[availableBoxes.at(-1)] = [];
    return availableBoxes.at(-1);
};

/**
 * Gets the current results of an isolate box
 * @name getStatus
 * @function
 * @memberof module:judge
 * @param {number} boxID 
 * @returns {Result} Results
 */
module.exports.getStatus = (boxID) => results[boxID];

/**
 * Judges a code submission to a problem
 * @name judge
 * @function
 * @memberof module:judge
 * @param {string} code 
 * @param {models.ProblemModel} problem 
 * @returns {Result} Results of the submission
 */
module.exports.judge = async (code, problem) => {
    if (availableBoxes.length == 0) {
        console.error("No available grading server. Frontend should check if grading server is available before submitting!");
        return ["Error with grading server. Please try submitting again!"];
    }
    const boxID = availableBoxes.pop();
    results[boxID] = [];
    // code must be less than 100,000 bytes
    if (code.length > 100000) {
        console.error("Code file too large!");
        return [{status: "RTE", time: "0s", mem:"0 MB"}];
    }

    const submissionDir = path.join(__dirname, "..", "isolate", boxID.toString());
    const codeFile = path.join(submissionDir, "code.py");
    
    if (!initializedIsolate) {
        await initIsolate();
        initializedIsolate = true;
    }

    try {
        fs.writeFileSync(codeFile, code);
        fs.copyFileSync(codeFile, path.join(boxPaths[boxID], "code.py"));
    } catch (error) {
        console.log("Error writing code file:", error);
    }

    for (let testcase = 0; testcase < problem.inputTestcases.length; testcase++) {
        results[boxID].push({ status: `...`, time: "...", mem: "..." });
        results[boxID][testcase] = await runProgram(boxID, submissionDir, problem, testcase);
    }

    // return it back to the stack
    availableBoxes.push(boxID);

    return results[boxID];
}

/**
 * Initializes isolate and sets box paths
 * @private
 * @memberof module:judge
 */
async function initIsolate() {
    // run commands concurrently
    const promises = new Array(numBoxes).fill(0).map((_, boxID) =>
        new Promise((resolve) => {
            const child = spawn(`isolate`, [`--cg`, `--box-id=${boxID}`, `--init`]); 
            child.stdout.on('data', (data) => { 
                let stdout = data.toString();
                boxPaths[boxID] = `${stdout.trim()}/box/`;
            });
            child.on('close', resolve);
        })
    );
    await Promise.all(promises);
    console.log("Initialized Isolate boxes!");
}

/**
 * Runs the code inside a box and compares the results to the testcase
 * @private
 * @memberof module:judge
 * @param {number} boxID What box it is
 * @param {string} submissionDir Where the submission is being stored
 * @param {models.ProblemModel} problem The problem
 * @param {number} testcase What testcase number it is
 * @returns {Result} What were the results of the code
 */
async function runProgram(boxID, submissionDir, problem, testcase) {
    const timeLimit = 4;
    const timeWall = 2*timeLimit; // used to prevent sleeping
    const memLimit = 256 * 1024; // 256 MB is the USACO limit. could lower to allow more control groups
    const args = [`--cg`, `--dir=${submissionDir}`, `--meta=${path.join(submissionDir, "meta.txt")}`, `--time=${timeLimit}`, `--wall-time=${timeWall}`, `--cg-mem=${memLimit}`, `--box-id=${boxID}`, `--run`, `--`, `/bin/python3`, `-O`, `code.py`];
    const expected = problem.outputTestcases[testcase].trim();
    let result = {status: "", time: "", mem: ""};
    const checkOutput = (stdout) => {
        const metadata = parseMetafile(submissionDir);
        if (metadata.status == "TO") {
            result.status = "TLE";
        } else if (metadata['exitsig'] == 9) { // exit signal 9 is memory limit exceeded i think
            result.status = "MLE";
        } else if (metadata.status != undefined) {
            result.status = "RTE";
        } else {
            result.status = stdout.trim() == expected ? "AC" : "WA";
        }
        result.time = `${metadata.time}s`;
        result.mem = `${(metadata['max-rss']/1024.0).toFixed(2)} MB`;
    }
    try {
        await new Promise(async (resolve) => { 
            const child = spawn(`isolate`, args);
            child.stdin.write(problem.inputTestcases[testcase]);
            child.stdin.end();
            child.on('error', err => console.error(err));
            let stdout = "";
            child.stdout.on('data', data => stdout += data.toString());
            child.on('close', () => {
                checkOutput(stdout);
                resolve();
            });
        });
    } catch (error) {
        console.error("Error running isolate:", error);
    }
    return result;
}

/**
 * Parses the metafile of the program we ran in isolate
 * @private
 * @memberof module:judge
 * @param {string} submissionDir - where the metafile is
 * @returns {Object<string, string>} Metafile as a map
 */
function parseMetafile(submissionDir) {
    const metadataArr = fs.readFileSync(path.join(submissionDir, "meta.txt")).toString().split(":").join("\n").split("\n");
    const metadata = {};
    for (let i = 0; i < metadataArr.length-2 /*ignore last two characters*/; i += 2) {
        metadata[metadataArr[i]] = metadataArr[i+1];
    }
    return metadata;
}

/**
 * @private
 * @memberof module:judge
 * Shuts down isolate
 */
async function closeIsolate() {
    console.log("Attempting to close Isolate!");
    const promises = new Array(numBoxes).fill(0).map((_, boxID) =>
        new Promise((resolve) => { spawn(`isolate`, [`--cg`, `--box-id=${boxID}`, `--cleanup`]).on('close', resolve); })
    );
    await Promise.all(promises);
    console.log("Closed Isolate!");
}

process.on("SIGINT", async (code) => {
    await closeIsolate();
    process.exit(code);
});

process.on("SIGTERM", async (code) => {
    await closeIsolate();
    process.exit(code);
});

