import { Types } from "mongoose";

import * as judge from "../judge";
import { Submission } from "../models";
import { IProblemWithTestcases, IResult } from "../types/models";
import { findContestByStorageId } from "./contests";
import { getContestProblem, getProblemWithTestcases } from "./problems";

export interface CreateSubmissionInput {
    code: string;
    contestId?: null | string;
    contestScored?: boolean;
    problem: IProblemWithTestcases;
    userId: Types.ObjectId;
}

export async function createSubmission(input: CreateSubmissionInput): Promise<string> {
    const submission = await Submission.create({
        code: input.code,
        contestId: input.contestId ?? null,
        contestScored: input.contestScored ?? false,
        problemId: input.problem.id,
        results: [],
        status: "queued",
        userId: input.userId,
    });

    void runSubmission(submission._id.toString(), input.code, input.problem);
    return submission._id.toString();
}

export async function getLatestSubmission(userId: Types.ObjectId, problemId: string, contestId?: null | string) {
    return Submission.findOne({
        contestId: contestId ?? null,
        problemId,
        userId,
    }).sort({ createdAt: -1 });
}

export async function resumePendingSubmissions(): Promise<void> {
    const pendingSubmissions = await Submission.find({ status: { $in: ["queued", "running"] } }).sort({ createdAt: 1 });

    for (const submission of pendingSubmissions) {
        const problem = await resolveSubmissionProblem(submission.problemId, submission.contestId);
        if (!problem) {
            submission.status = "failed";
            submission.error = "Problem no longer exists.";
            submission.completedAt = new Date();
            await submission.save();
            continue;
        }

        void runSubmission(submission._id.toString(), submission.code, problem);
    }
}

export async function runSubmission(submissionId: string, code: string, problem: IProblemWithTestcases): Promise<void> {
    try {
        await Submission.findByIdAndUpdate(submissionId, { $set: { error: undefined, status: "running" } });
        const results = await judge.judgeCode(code, problem, async (progress) => {
            await updateProgress(submissionId, progress);
        });

        await Submission.findByIdAndUpdate(submissionId, {
            $set: {
                completedAt: new Date(),
                results,
                status: "completed",
            },
            $unset: { error: "" },
        });
        judge.publishResults(submissionId, results, true);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown judge error";
        const results: IResult[] = [{ mem: "0 MB", status: "RTE", time: "0s" }];
        await Submission.findByIdAndUpdate(submissionId, {
            $set: {
                completedAt: new Date(),
                error: message,
                results,
                status: "failed",
            },
        });
        judge.publishResults(submissionId, results, true);
    }
}

async function resolveSubmissionProblem(problemId: string, contestId?: null | string): Promise<IProblemWithTestcases | null> {
    if (!contestId) {
        return getProblemWithTestcases(problemId, true);
    }

    const contest = await findContestByStorageId(contestId);
    if (!contest) {
        return null;
    }

    return getContestProblem(contest, problemId, true);
}

async function updateProgress(submissionId: string, results: IResult[]): Promise<void> {
    await Submission.findByIdAndUpdate(submissionId, { $set: { results, status: "running" } });
    judge.publishResults(submissionId, results, false);
}
