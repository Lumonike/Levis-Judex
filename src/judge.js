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

const { spawn } = require("child_process");
const express = require("express");
const fs = require("fs");
const path = require("path");

const models = require("./models.js");

/**
 * @typedef {Object} Submission
 * @property {string} code The code submitted
 * @property {models.ProblemType} problem The problem the code is submitted to
 * @property {number} boxID What box ID the submission is occurring
 * @property {models.ResultType[]} results List of results
 * @property {express.Response[] | null} clients Clients to send updates to
 * @memberof module:judge
 */

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
 * Get submission by submission id
 * @name submissions
 * @type {Object<string, Submission>}
 * @memberof module:judge
 */
const submissions = {};

/**
 * Saves a submission to be judged
 * @name queueSubmission
 * @memberof module:judge
 * @function
 * @param {string} submissionID
 * @param {string} code
 * @param {models.ProblemType} problem
 */
module.exports.queueSubmission = (submissionID, code, problem) => {
    submissions[submissionID] = {
        boxID: -1,
        clients: [],
        code,
        problem,
        results: [],
    };
};

/**
 * @name getResults
 * @memberof module:judge
 * @function
 * @param {string} submissionID Submission ID
 * @returns {models.ResultType[]} The results so far
 */
module.exports.getResults = (submissionID) => {
    if (!submissions[submissionID]) {
        return [];
    }
    return submissions[submissionID].results;
};

/**
 * @name addClient
 * @memberof module:judge
 * @function
 * @param {string} submissionID
 * @param {express.Response} res
 */
module.exports.addClient = (submissionID, res) => {
    if (submissions[submissionID]) {
        submissions[submissionID].clients.push(res);
    }
};

/**
 * Judges a code submission to a problem
 * @name judge
 * @function
 * @memberof module:judge
 * @param {string} submissionID
 * @returns {models.ResultType} Results of the submission
 */
module.exports.judge = async (submissionID) => {
    const submission = submissions[submissionID];
    if (!submission) {
        return ["Invalid submission ID!"];
    }
    await new Promise((resolve) => {
        const getBoxID = setInterval(() => {
            if (availableBoxes.length > 0) {
                submission.boxID = availableBoxes.pop();
                clearInterval(getBoxID);
                resolve();
            }
        }, 100);
    });

    const { boxID, code, problem, results } = submission;
    // code must be less than 100,000 bytes
    if (code.length > 100000) {
        console.error("Code file too large!");
        return [{ mem: "0 MB", status: "RTE", time: "0s" }];
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
        console.error("Error writing code file:", error);
        return [{ mem: "0 MB", status: "RTE", time: "0s" }];
    }

    for (let testcase = 0; testcase < problem.inputTestcases.length; testcase++) {
        results.push({ mem: "...", status: `...`, time: "..." });
        for (const client of submission.clients) {
            client.write(`data: ${JSON.stringify(submission.results)}\n\n`);
        }
        results[testcase] = await runProgram(boxID, submissionDir, problem, testcase);
        for (const client of submission.clients) {
            client.write(`data: ${JSON.stringify(submission.results)}\n\n`);
        }
    }

    const finalResults = [...results];
    for (const client of submission.clients) {
        client.write(`event: done\ndata: ${JSON.stringify(finalResults)}\n\n`);
    }

    // cleanup
    availableBoxes.push(boxID);
    delete submissions[submissionID];

    return finalResults;
};

/**
 * @private
 * @memberof module:judge
 * Shuts down isolate
 */
async function closeIsolate() {
    console.log("Attempting to close Isolate!");
    const promises = new Array(numBoxes).fill(0).map(
        (_, boxID) =>
            new Promise((resolve) => {
                spawn(`isolate`, [`--cg`, `--box-id=${boxID}`, `--cleanup`]).on("close", resolve);
            }),
    );
    await Promise.all(promises);
    console.log("Closed Isolate!");
}

/**
 * Initializes isolate and sets box paths
 * @private
 * @memberof module:judge
 */
async function initIsolate() {
    // run commands concurrently
    const promises = new Array(numBoxes).fill(0).map(
        (_, boxID) =>
            new Promise((resolve) => {
                const child = spawn(`isolate`, [`--cg`, `--box-id=${boxID}`, `--init`]);
                child.stdout.on("data", (data) => {
                    let stdout = data.toString();
                    boxPaths[boxID] = `${stdout.trim()}/box/`;
                });
                child.on("close", resolve);
            }),
    );
    await Promise.all(promises);
    console.log("Initialized Isolate boxes!");
}

/**
 * Parses the metafile of the program we ran in isolate
 * @private
 * @memberof module:judge
 * @param {string} submissionDir - where the metafile is
 * @returns {Object<string, string>} Metafile as a map
 */
function parseMetafile(submissionDir) {
    try {
        const metadataArr = fs.readFileSync(path.join(submissionDir, "meta.txt")).toString().split(":").join("\n").split("\n");
        const metadata = {};
        for (let i = 0; i < metadataArr.length - 2 /*ignore last two characters*/; i += 2) {
            metadata[metadataArr[i]] = metadataArr[i + 1];
        }
        return metadata;
    } catch (error) {
        console.error("Error parsing metafile:", error);
        return { "max-rss": "0", status: "RTE", time: "0s" };
    }
}

/**
 * Runs the code inside a box and compares the results to the testcase
 * @private
 * @memberof module:judge
 * @param {number} boxID What box it is
 * @param {string} submissionDir Where the submission is being stored
 * @param {models.ProblemType} problem The problem
 * @param {number} testcase What testcase number it is
 * @returns {models.ResultType} What were the results of the code
 */
async function runProgram(boxID, submissionDir, problem, testcase) {
    const timeLimit = 4;
    const timeWall = 2 * timeLimit; // used to prevent sleeping
    const memLimit = 256 * 1024; // 256 MB is the USACO limit. could lower to allow more control groups
    const args = [
        `--cg`,
        `--dir=${submissionDir}`,
        `--meta=${path.join(submissionDir, "meta.txt")}`,
        `--time=${timeLimit}`,
        `--wall-time=${timeWall}`,
        `--cg-mem=${memLimit}`,
        `--box-id=${boxID}`,
        `--run`,
        `--`,
        `/bin/python3`,
        `-O`,
        `code.py`,
    ];
    const expected = problem.outputTestcases[testcase].trim();
    let result = { mem: "", status: "", time: "" };
    const checkOutput = (stdout) => {
        const metadata = parseMetafile(submissionDir);
        if (metadata.status == "TO") {
            result.status = "TLE";
        } else if (metadata["exitsig"] == 9) {
            // exit signal 9 is memory limit exceeded i think
            result.status = "MLE";
        } else if (metadata.status != undefined) {
            result.status = "RTE";
        } else {
            result.status = stdout.trim() == expected ? "AC" : "WA";
        }
        result.time = `${metadata.time}s`;
        result.mem = `${(metadata["max-rss"] / 1024.0).toFixed(2)} MB`;
    };
    try {
        await new Promise(async (resolve) => {
            const child = spawn(`isolate`, args);
            child.stdin.write(problem.inputTestcases[testcase]);
            child.stdin.end();
            child.on("error", (err) => console.error(err));
            let stdout = "";
            child.stdout.on("data", (data) => (stdout += data.toString()));
            child.on("close", () => {
                checkOutput(stdout);
                resolve();
            });
        });
    } catch (error) {
        console.error("Error running isolate:", error);
    }
    return result;
}

process.on("SIGINT", async () => {
    await closeIsolate();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await closeIsolate();
    process.exit(0);
});
