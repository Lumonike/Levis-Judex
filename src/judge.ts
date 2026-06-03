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

import { IProblemWithTestcases, IResult } from "./types/models";

let initializedIsolate = false;
let initIsolatePromise: Promise<void> | undefined;

const numBoxes = 5;

/**
 * Maximum number of testcases a problem can have
 */
export const maxTestcases = 50;

const boxPaths = new Array<string>(numBoxes);
const availableBoxes = new Array<number>(numBoxes).fill(0).map((_, index) => index);
const clients = new Map<string, Response[]>();

/**
 * Adds client to watch a persisted submission.
 * @param submissionID Id of submission
 * @param res client
 */
export function addClient(submissionID: string, res: Response): void {
    const submissionClients = clients.get(submissionID) ?? [];
    submissionClients.push(res);
    clients.set(submissionID, submissionClients);
}

/**
 * Judges source code against a problem.
 * @param code Submitted source
 * @param problem Problem with judge-only testcases loaded
 * @param onProgress Optional progress callback
 * @returns Final testcase results
 */
export async function judgeCode(
    code: string,
    problem: IProblemWithTestcases,
    onProgress?: (results: IResult[]) => Promise<void> | void,
): Promise<IResult[]> {
    if (code.length > 100000) {
        console.error("Code file too large!");
        return [{ mem: "0 MB", status: "RTE", time: "0s" }];
    }

    let boxID: number | undefined;
    const results: IResult[] = [];

    try {
        if (!initializedIsolate) {
            await ensureIsolateInitialized();
        }

        boxID = await acquireBox();

        const submissionDir = path.join(__dirname, "..", "isolate", boxID.toString());
        const codeFile = path.join(submissionDir, "code.py");

        fs.mkdirSync(submissionDir, { recursive: true });
        fs.writeFileSync(codeFile, code);
        fs.copyFileSync(codeFile, path.join(boxPaths[boxID], "code.py"));

        for (let testcase = 0; testcase < problem.inputTestcases.length; testcase++) {
            results.push({ mem: "...", status: "...", time: "..." });
            await onProgress?.([...results]);
            results[testcase] = await runProgram(boxID, submissionDir, problem, testcase);
            await onProgress?.([...results]);
        }

        return [...results];
    } catch (error) {
        console.error("Error judging submission:", error);
        return [{ mem: "0 MB", status: "RTE", time: "0s" }];
    } finally {
        if (boxID !== undefined) {
            availableBoxes.push(boxID);
        }
    }
}

/**
 * Broadcasts submission progress to SSE clients.
 * @param submissionID id of submission
 * @param results current results
 * @param completed whether judging has finished
 */
export function publishResults(submissionID: string, results: IResult[], completed: boolean): void {
    const submissionClients = clients.get(submissionID) ?? [];
    for (const client of submissionClients) {
        if (client.writableEnded || client.destroyed) {
            removeClient(submissionID, client);
            continue;
        }

        try {
            if (completed) {
                client.write(`event: done\ndata: ${JSON.stringify(results)}\n\n`);
            } else {
                client.write(`data: ${JSON.stringify(results)}\n\n`);
            }
        } catch (err) {
            console.error("SSE write error:", err);
            removeClient(submissionID, client);
        }
    }

    if (completed) {
        clients.delete(submissionID);
    }
}

/**
 * Removes client from watching submission
 * @param submissionID id of submission
 * @param res client
 */
export function removeClient(submissionID: string, res: Response): void {
    const submissionClients = clients.get(submissionID);
    if (!submissionClients) return;

    const remainingClients = submissionClients.filter((client) => client !== res);
    if (remainingClients.length === 0) {
        clients.delete(submissionID);
    } else {
        clients.set(submissionID, remainingClients);
    }
}

async function acquireBox(): Promise<number> {
    return new Promise<number>((resolve) => {
        const getBoxID = setInterval(() => {
            if (availableBoxes.length > 0) {
                const boxID = availableBoxes.pop();
                if (boxID !== undefined) {
                    clearInterval(getBoxID);
                    resolve(boxID);
                }
            }
        }, 100);
    });
}

async function ensureIsolateInitialized(): Promise<void> {
    initIsolatePromise ??= initIsolate().then(() => {
        initializedIsolate = true;
    });
    await initIsolatePromise;
}

/**
 * Initializes isolate and sets box paths
 * @private
 * @memberof module:judge
 */
async function initIsolate(): Promise<void> {
    const promises = new Array(numBoxes).fill(0).map(
        (_, boxID) =>
            new Promise<void>((resolve, reject) => {
                const child = spawn("isolate", ["--cg", `--box-id=${boxID.toString()}`, "--init"]);
                child.stdout.on("data", (data: Buffer) => {
                    const stdout = data.toString();
                    boxPaths[boxID] = `${stdout.trim()}/box/`;
                });
                child.on("close", (code) => {
                    if (code === 0 && boxPaths[boxID]) {
                        resolve();
                    } else {
                        reject(new Error(`Failed to initialize isolate box ${boxID.toString()}`));
                    }
                });
                child.on("error", reject);
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
        for (let i = 0; i < metadataArr.length - 2; i += 2) {
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
async function runProgram(boxID: number, submissionDir: string, problem: IProblemWithTestcases, testcase: number): Promise<IResult> {
    const timeLimit = 4;
    const timeWall = 2 * timeLimit;
    const memLimit = 256 * 1024;
    const args = [
        "--cg",
        `--dir=${submissionDir}`,
        `--meta=${path.join(submissionDir, "meta.txt")}`,
        `--time=${timeLimit.toString()}`,
        `--wall-time=${timeWall.toString()}`,
        `--cg-mem=${memLimit.toString()}`,
        `--box-id=${boxID.toString()}`,
        "--run",
        "--",
        "/bin/python3",
        "-O",
        "code.py",
    ];
    const expected = problem.outputTestcases[testcase].trim();
    const result: IResult = { mem: "", status: "...", time: "" };

    const checkOutput = (stdout: string) => {
        const metadata = parseMetafile(submissionDir);
        if (metadata.status == "TO") {
            result.status = "TLE";
        } else if (metadata.exitsig == "9") {
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
            const child = spawn("isolate", args);

            child.stdin.on("error", (err) => {
                if ("code" in err && err.code === "EPIPE") {
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
                console.error("Error writing to isolate stdin:", err);
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
