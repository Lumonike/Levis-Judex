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

const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

let initializedIsolate = false;
let inProgress = false;
const numBoxes = 5;
module.exports.maxTestcases = 50;
const boxPaths = new Array(numBoxes);
// stack of ids
const availableBoxes = new Array(numBoxes).fill(0).map((_, index) => index);
// results for each box
const results = new Array(numBoxes).fill([]);

module.exports.getBoxID = () => {
    if (availableBoxes.length == 0) return -1;
    results[availableBoxes.at(-1)] = [];
    return availableBoxes.at(-1);
};

module.exports.getStatus = (boxID) => results[boxID];

module.exports.judge = async (code, problem) => {
    if (availableBoxes.length == 0) {
        console.error("No available grading server. Frontend should check if grading server is available before submitting!");
        return ["Error with grading server. Please try submitting again!"];
    }
    const boxID = availableBoxes.pop();
    results[boxID] = [];
    inProgress = true;

    // code must be less than 100,000 bytes
    if (code.length > 100000) {
        console.error("Code file too large!");
        return [{status: "RTE", time: "0s", mem:"0 MB"}];
    }

    const submissionDir = path.join(__dirname, "private", "isolate", boxID.toString());
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
    inProgress = false;

    return results[boxID];
}

async function initIsolate() {
    // run commands concurrently
    const promises = new Array(numBoxes).fill(0).map((_, boxID) =>
        new Promise((resolve) => { exec(`isolate --cg --box-id=${boxID} --init`, (error, stdout) => { 
            boxPaths[boxID] = `${stdout.trim()}/box/`;
        }).on('close', resolve); })
    );
    await Promise.all(promises);
    console.log("Initialized Isolate boxes!");
}

async function runProgram(boxID, submissionDir, problem, testcase) {
    const timeLimit = 4;
    const timeWall = 2*timeLimit; // used to prevent sleeping
    const memLimit = 256 * 1024; // 256 MB is the USACO limit. could lower to allow more control groups
    const command = `isolate --cg --dir=${submissionDir} --meta=${path.join(submissionDir, "meta.txt")} --time=${timeLimit} --wall-time=${timeWall} --cg-mem=${memLimit} --box-id=${boxID} --run -- /bin/python3 -O code.py`;
    const expected = problem.outputTestcases[testcase].trim();
    let result = {status: "", time: "", mem: ""};
    const checkOutput = (error, stdout) => {
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
            const child = exec(command, checkOutput);
            // i have to write in chunks to prevent a crash
            let i = 0;
            const writeChunks = () => {
                while (i < problem.inputTestcases[testcase].length) {
                    const chunk = problem.inputTestcases[testcase].slice(i, i+child.stdin.writableHighWaterMark);
                    const canWrite = child.stdin.write(chunk);
                    i += child.stdin.writableHighWaterMark;
                    if (!canWrite) {
                        child.stdin.once('drain', writeChunks);
                        return;
                    }
                }
            }
            await new Promise((resolve, reject) => {
                child.stdin.on('error', reject);
                writeChunks();
                resolve();
            })
            child.stdin.end();
            child.on('close', resolve);
        });
    } catch (error) {
        console.error("Error running isolate:", error);
    }
    return result;
}

function parseMetafile(submissionDir) {
    const metadataArr = fs.readFileSync(path.join(submissionDir, "meta.txt")).toString().split(":").join("\n").split("\n");
    const metadata = {};
    for (let i = 0; i < metadataArr.length-2 /*ignore last two characters*/; i += 2) {
        metadata[metadataArr[i]] = metadataArr[i+1];
    }
    return metadata;
}

async function closeIsolate() {
    console.log("Attempting to close Isolate!");
    const promises = new Array(numBoxes).fill(0).map((_, boxID) =>
        new Promise((resolve) => { exec(`isolate --cg --box-id=${boxID} --cleanup`).on('close', resolve); })
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

