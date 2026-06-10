import { Types } from "mongoose";
import validator from "validator";

import { MAX_CONTESTS_PER_CLUB, MAX_PROBLEMS_PER_CONTEST } from "../lib/limits";
import { sanitizeProblemHtml } from "../lib/sanitize";
import { Contest } from "../models";
import { contestScopeFilter, getContestStorageId } from "./contest-scope";
import { ContestProblemInput, ContestSaveInput } from "./contests";
import { getContestProblemIds, getProblemWithTestcases } from "./problems";

const maxTestcases = 50;

export interface ContestSaveBody {
    accessType?: string;
    clubId?: null | string;
    durationMinutes?: number;
    endTime: string;
    existingProblemIds?: string[];
    id: string;
    inlineProblems?: ContestProblemInput[];
    name: string;
    problemPoints?: Record<string, number>;
    startTime: string;
    timingMode: string;
}

export async function getEditableContest(id: string, clubId?: null | string): Promise<null | Record<string, unknown>> {
    const contest = await Contest.findOne(contestScopeFilter(validator.escape(id.trim()), clubId)).lean();
    if (!contest) {
        return null;
    }

    const problemIds = getContestProblemIds(contest);
    const contestStorageId = getContestStorageId(contest);
    const scopedProblems = (await Promise.all(problemIds.map((problemId) => getProblemWithTestcases(problemId, true, contestStorageId)))).filter(
        (problem) => problem !== null,
    );
    const scopedProblemIds = new Set(scopedProblems.map((problem) => problem.id));
    const existingProblemIds = problemIds.filter((problemId) => !scopedProblemIds.has(problemId));

    return {
        ...contest,
        problemIds: existingProblemIds,
        problemPoints: serializeProblemPoints(contest.problemPoints),
        problems: scopedProblems,
    };
}

export function isExpectedContestSaveError(message: string): boolean {
    return [
        `Clubs can create up to ${MAX_CONTESTS_PER_CLUB.toString()} contests.`,
        `Contests can include up to ${MAX_PROBLEMS_PER_CONTEST.toString()} problems.`,
        "Class or club does not exist.",
        "Contest must include at least one problem",
        "One or more contest problems do not exist.",
        "Problem points must be a positive number",
        "Restricted contests require a class or club.",
    ].includes(message);
}

export function parseContestSaveBody(body: ContestSaveBody, createdBy?: Types.ObjectId): ContestSaveInput {
    const { accessType, clubId, durationMinutes, endTime, existingProblemIds, id, inlineProblems, name, problemPoints, startTime, timingMode } = body;

    if (!id || typeof id !== "string") {
        throw new Error("Contest ID is required and must be a string");
    }
    if (!name || typeof name !== "string") {
        throw new Error("Contest name is required and must be a string");
    }
    if (timingMode !== "global" && timingMode !== "personal") {
        throw new Error("Contest timing mode must be global or personal");
    }
    if (timingMode === "personal" && (typeof durationMinutes !== "number" || durationMinutes <= 0)) {
        throw new Error("Personal contests require a positive duration");
    }
    if (accessType !== undefined && accessType !== "club" && accessType !== "public") {
        throw new Error("Contest access must be public or class/club");
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime()) || parsedStartTime >= parsedEndTime) {
        throw new Error("Contest start and end times are invalid");
    }

    const sanitizedExistingProblemIds = normalizeProblemIds(existingProblemIds ?? []);
    const sanitizedInlineProblems = (inlineProblems ?? []).map((problem) => normalizeContestProblem(problem));
    const sanitizedProblemPoints = normalizeProblemPoints(
        [...sanitizedExistingProblemIds, ...sanitizedInlineProblems.map((problem) => problem.id)],
        problemPoints ?? {},
        sanitizedInlineProblems,
    );
    if (sanitizedExistingProblemIds.length + sanitizedInlineProblems.length === 0) {
        throw new Error("Contest must include at least one problem");
    }

    return {
        accessType: accessType === "club" ? "club" : "public",
        clubId: typeof clubId === "string" ? validator.escape(clubId.trim()) : null,
        ...(createdBy ? { createdBy } : {}),
        durationMinutes,
        endTime: parsedEndTime,
        existingProblemIds: sanitizedExistingProblemIds,
        id: validator.escape(id.trim()),
        inlineProblems: sanitizedInlineProblems,
        name: validator.escape(name.trim()),
        problemPoints: sanitizedProblemPoints,
        startTime: parsedStartTime,
        timingMode,
    };
}

function normalizeContestProblem(problem: ContestProblemInput): ContestProblemInput {
    const update = { ...problem };

    if (!update.id || typeof update.id !== "string") {
        throw new Error("Inline problem ID is required");
    }
    if (!update.name || typeof update.name !== "string") {
        throw new Error("Inline problem name is required");
    }
    if (!update.problemStatement || typeof update.problemStatement !== "string") {
        throw new Error("Inline problem statement is required");
    }
    if (!update.inputFormat || typeof update.inputFormat !== "string" || !update.outputFormat || typeof update.outputFormat !== "string") {
        throw new Error("Inline problem input and output formats are required");
    }
    if (typeof update.numSampleTestcases !== "number" || update.numSampleTestcases < 0) {
        throw new Error("Inline problem sample count is invalid");
    }
    if (!Array.isArray(update.inputTestcases) || !Array.isArray(update.outputTestcases)) {
        throw new Error("Inline problem testcases are invalid");
    }
    if (
        update.inputTestcases.length === 0 ||
        update.inputTestcases.length > maxTestcases ||
        update.inputTestcases.length !== update.outputTestcases.length
    ) {
        throw new Error(`Inline problems must have between 1 and ${maxTestcases.toString()} matching input/output testcases`);
    }
    if (update.numSampleTestcases > update.inputTestcases.length) {
        throw new Error("Inline problem sample count cannot exceed total testcase count");
    }

    return {
        ...update,
        id: validator.escape(update.id.trim()),
        inputFormat: sanitizeProblemHtml(update.inputFormat),
        isPrivate: false,
        name: validator.escape(update.name.trim()),
        outputFormat: sanitizeProblemHtml(update.outputFormat),
        points: normalizePointValue(update.points),
        problemStatement: sanitizeProblemHtml(update.problemStatement),
        whitelist: [],
    };
}

function normalizePointValue(points: unknown): number {
    const value = Number(points ?? 100);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Problem points must be a positive number");
    }

    return value;
}

function normalizeProblemIds(problemIds: string[]): string[] {
    if (!Array.isArray(problemIds) || !problemIds.every((problemId) => typeof problemId === "string")) {
        throw new Error("Existing problem IDs must be strings");
    }

    return [...new Set(problemIds.map((problemId) => validator.escape(problemId.trim())).filter((problemId) => problemId.length > 0))];
}

function normalizeProblemPoints(
    problemIds: string[],
    problemPoints: Record<string, number>,
    inlineProblems: ContestProblemInput[],
): Record<string, number> {
    const inlineProblemPoints = new Map(inlineProblems.map((problem) => [problem.id, problem.points]));

    return Object.fromEntries(
        [...new Set(problemIds)].map((problemId) => {
            const rawPoints = inlineProblemPoints.get(problemId) ?? problemPoints[problemId];
            return [problemId, normalizePointValue(rawPoints)];
        }),
    );
}

function serializeProblemPoints(problemPoints: unknown): Record<string, number> {
    if (problemPoints instanceof Map) {
        return Object.fromEntries([...problemPoints.entries()].map(([problemId, points]) => [String(problemId), Number(points)]));
    }
    if (typeof problemPoints === "object" && problemPoints !== null) {
        return Object.fromEntries(Object.entries(problemPoints).map(([problemId, points]) => [problemId, Number(points)]));
    }

    return {};
}
