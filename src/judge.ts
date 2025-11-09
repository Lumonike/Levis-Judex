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

import { spawn } from "child_process";
import { Response } from "express";
import fs from "fs";
import path from "path";

import { JudgeSubmission } from "./types/judge";
import { IProblem, IResult } from "./types/models";

let initializedIsolate = false;

const numBoxes = 5;

/**
 * Maximum number of testcases a problem can have
 */
export const maxTestcases = 50;

const boxPaths = new Array<string>(numBoxes);

const availableBoxes = new Array<number>(numBoxes).fill(0).map((_, index) => index);

const submissions: Record<string, JudgeSubmission | undefined> = {};

/**
 * Adds client to watch submission
 * @param submissionID Id of submission
 * @param res client
 */
export function addClient(submissionID: string, res: Response) {
    if (submissions[submissionID]?.clients) {
        submissions[submissionID].clients.push(res);
    }
}

/**
 * Gets results of submission
 * @param submissionID Submission ID
 * @returns The results so far
 */
export function getResults(submissionID: string): IResult[] {
    if (!submissions[submissionID]) {
        return [];
    }
    return submissions[submissionID].results;
}


/**
 * Judges a code submission to a problem
 * @param submissionID id of submission
 * @returns Results of the submission
 */
export async function judge(submissionID: string): Promise<IResult[]> {
    const submission = submissions[submissionID];
    if (!submission) {
        return [{ mem: "...", status: "RTE", time: "..." }];
    }
    await new Promise<void>((resolve) => {
        const getBoxID = setInterval(() => {
            if (availableBoxes.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                submission.boxID = availableBoxes.pop()!;
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
        for (const client of submission.clients ?? []) {
            const res = client;
            if (!res.writableEnded && !res.destroyed) {
                try {
                    res.write(`data: ${JSON.stringify(submission.results)}\n\n`);
                } catch (err) {
                    console.error('SSE write error:', err);
                    removeClient(submissionID, client);
                }
            }
        }
        results[testcase] = await runProgram(boxID, submissionDir, problem, testcase);
        for (const client of submission.clients ?? []) {
            const res = client;
            if (!res.writableEnded && !res.destroyed) {
                try {
                    res.write(`data: ${JSON.stringify(submission.results)}\n\n`);
                } catch (err) {
                    console.error('SSE write error:', err);
                    removeClient(submissionID, client);
                }
            }
        }
    }

    const finalResults = [...results];
    for (const client of submission.clients ?? []) {
        const res = client;
        if (!res.writableEnded && !res.destroyed) {
            try {
                client.write(`event: done\ndata: ${JSON.stringify(finalResults)}\n\n`);
            } catch (err) {
                console.error('SSE write error:', err);
                removeClient(submissionID, client);
            }
        }
    }

    // cleanup
    availableBoxes.push(boxID);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete submissions[submissionID];

    return finalResults;
}

/**
 * Saves a submission to be judged
 * @param submissionID Id of submission
 * @param code Code of submission
 * @param problem Problem being submitted
 */
export function queueSubmission(submissionID: string, code: string, problem: IProblem) {
    submissions[submissionID] = {
        boxID: -1,
        clients: [],
        code,
        problem,
        results: [],
    };
}

/**
 * Removes client from watching submission
 * @param submissionID id of submission
 * @param res client
 */
export function removeClient(submissionID: string, res: Response) {
    const submission = submissions[submissionID];
    if (!submission?.clients) return;

    submission.clients = submission.clients.filter(c => c !== res);
}

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
                spawn(`isolate`, [`--cg`, `--box-id=${boxID.toString()}`, `--cleanup`]).on("close", resolve);
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
                const child = spawn(`isolate`, [`--cg`, `--box-id=${boxID.toString()}`, `--init`]);
                child.stdout.on("data", (data: Buffer) => {
                    const stdout = data.toString();
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
 * @param submissionDir - where the metafile is
 * @returns Metafile as a map
 */
function parseMetafile(submissionDir: string): Record<string, string | undefined> {
    try {
        const metadataArr = fs.readFileSync(path.join(submissionDir, "meta.txt")).toString().split(":").join("\n").split("\n");
        const metadata: Record<string, string | undefined> = {};
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
 * @param boxID What box it is
 * @param submissionDir Where the submission is being stored
 * @param problem The problem
 * @param testcase What testcase number it is
 * @returns What were the results of the code
 */
async function runProgram(boxID: number, submissionDir: string, problem: IProblem, testcase: number): Promise<IResult> {
    const timeLimit = 4;
    const timeWall = 2 * timeLimit; // used to prevent sleeping
    const memLimit = 256 * 1024; // 256 MB is the USACO limit. could lower to allow more control groups
    const args = [
        `--cg`,
        `--dir=${submissionDir}`,
        `--meta=${path.join(submissionDir, "meta.txt")}`,
        `--time=${timeLimit.toString()}`,
        `--wall-time=${timeWall.toString()}`,
        `--cg-mem=${memLimit.toString()}`,
        `--box-id=${boxID.toString()}`,
        `--run`,
        `--`,
        `/bin/python3`,
        `-O`,
        `code.py`,
    ];
    const expected = problem.outputTestcases[testcase].trim();
    const result: IResult = { mem: "", status: "...", time: "" };

    const checkOutput = (stdout: string) => {
        const metadata = parseMetafile(submissionDir);
        if (metadata.status == "TO") {
            result.status = "TLE";
        } else if (metadata.exitsig == "9") {
            // exit signal 9 is memory limit exceeded i think
            result.status = "MLE";
        } else if (metadata.status != undefined) {
            result.status = "RTE";
        } else {
            result.status = stdout.trim() == expected ? "AC" : "WA";
        }
        result.time = `${metadata.time ?? "0"}s`;
        result.mem = `${(parseInt(metadata["max-rss"] ?? "0") / 1024.0).toFixed(2)} MB`;
    };
    try {
        await new Promise<void>((resolve) => {
            const child = spawn(`isolate`, args);

            child.stdin.on("error", (err) => {
                if ('code' in err && err.code === "EPIPE") {
                    return;
                }
                console.error(err);
            });

            child.on("error", (err) => {
                console.error(err);
            });

            try {
                child.stdin.write(problem.inputTestcases[testcase]);
                child.stdin.end();
            } catch (err) {
                console.error('Error writing to isolate stdin:', err);
            }

            let stdout = "";
            child.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
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

process.on("SIGINT", () => {
    void closeIsolate().then(() => {
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    void closeIsolate().then(() => {
        process.exit(0);
    });
});
