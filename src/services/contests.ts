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

import { Types } from "mongoose";

import { MAX_CONTESTS_PER_CLUB, MAX_PROBLEMS_PER_CONTEST } from "../lib/limits";
import { ClassClub, Contest, ContestAttempt, Problem, Submission, User } from "../models";
import { IContest, IContestAttempt, IProblemWithTestcases, IResult } from "../types/models";
import { contestScopeFilter, getContestStorageId, parseContestStorageId } from "./contest-scope";
import { getContestProblem, saveProblemWithTestcases } from "./problems";

const defaultProblemPoints = 100;

export interface ContestProblemInput extends Omit<IProblemWithTestcases, "contestID" | "whitelist"> {
    isPrivate?: boolean;
    points?: number;
    whitelist?: (string | Types.ObjectId)[];
}

export interface ContestSaveInput {
    accessType?: "club" | "public";
    clubId?: null | string;
    createdBy?: Types.ObjectId;
    durationMinutes?: number;
    endTime: Date;
    existingProblemIds: string[];
    id: string;
    inlineProblems: ContestProblemInput[];
    name: string;
    problemPoints?: Record<string, number>;
    startTime: Date;
    timingMode: "global" | "personal";
}

export interface ContestState {
    attempt?: IContestAttempt;
    canStart: boolean;
    canSubmitForScore: boolean;
    canViewProblems: boolean;
    endsAt: Date;
    isBeforeOpen: boolean;
    isClosedForNewStarts: boolean;
    now: Date;
    startsAt: Date;
    status: "active" | "available" | "closed" | "not-started" | "unstarted";
}

export interface ScoreboardRow {
    elapsedMs: number;
    email: string;
    lastScoredAt?: Date;
    points: number;
    solved: number;
    userId: string;
}

interface SubmissionWithCreatedAt {
    completedAt?: Date;
    createdAt?: Date;
    problemId: string;
    results: IResult[];
    userId: Types.ObjectId;
}

export async function canAccessContest(contest: IContest, userId?: Types.ObjectId): Promise<boolean> {
    if ((contest.accessType ?? "public") === "public") {
        return true;
    }

    if (!userId || !contest.clubId) {
        return false;
    }

    const user = await User.findById(userId).select("admin email").lean();
    if (!user) {
        return false;
    }
    if (user.admin) {
        return true;
    }

    const club = await ClassClub.findOne({ id: contest.clubId }).select("memberEmails ownerId").lean();
    if (!club) {
        return false;
    }

    return club.ownerId?.toString() === userId.toString() || club.memberEmails.includes(user.email);
}

export async function findContestByScope(contestId: string, clubId?: null | string): Promise<IContest | null> {
    return Contest.findOne(contestScopeFilter(contestId, clubId)).lean<IContest>();
}

export async function findContestByStorageId(storageId: string): Promise<IContest | null> {
    const parsed = parseContestStorageId(storageId);
    return findContestByScope(parsed.id, parsed.clubId);
}

export function getContestProblemPoints(contest: null | Pick<IContest, "problemPoints"> | undefined, problemId: string): number {
    const points = readProblemPoints(contest?.problemPoints, problemId);
    return points ?? defaultProblemPoints;
}

export async function getContestState(contest: IContest, userId?: Types.ObjectId, now = new Date()): Promise<ContestState> {
    if (contest.timingMode === "personal") {
        return getPersonalContestState(contest, userId, now);
    }

    const canViewProblems = now >= contest.startTime;
    const canSubmitForScore = now >= contest.startTime && now < contest.endTime;

    return {
        canStart: false,
        canSubmitForScore,
        canViewProblems,
        endsAt: contest.endTime,
        isBeforeOpen: now < contest.startTime,
        isClosedForNewStarts: now >= contest.endTime,
        now,
        startsAt: contest.startTime,
        status: canSubmitForScore ? "active" : now < contest.startTime ? "not-started" : "closed",
    };
}

export async function getScoreboard(contestOrId: IContest | string, clubId?: null | string): Promise<ScoreboardRow[]> {
    const contest = typeof contestOrId === "string" ? await findContestByScope(contestOrId, clubId) : contestOrId;
    if (!contest) {
        return [];
    }
    const contestStorageId = getContestStorageId(contest);
    const submissions = await Submission.find({
        contestId: contestStorageId,
        contestScored: true,
        status: "completed",
    })
        .sort({ createdAt: 1 })
        .lean<SubmissionWithCreatedAt[]>();

    const attemptByUserId = new Map(
        (
            await ContestAttempt.find({
                contestId: contestStorageId,
                userId: { $in: [...new Set(submissions.map((submission) => submission.userId.toString()))] },
            }).lean<IContestAttempt[]>()
        ).map((attempt) => [attempt.userId.toString(), attempt]),
    );
    const sampleCountByProblemId = await getContestSampleCounts(contest);
    const users = await User.find({ _id: { $in: [...new Set(submissions.map((submission) => submission.userId.toString()))] } })
        .select("email")
        .lean();
    const emailByUserId = new Map(users.map((user) => [user._id.toString(), user.email]));
    const bestByUserAndProblem = new Map<string, SubmissionWithCreatedAt>();

    for (const submission of submissions) {
        const key = `${submission.userId.toString()}:${submission.problemId}`;
        const existing = bestByUserAndProblem.get(key);
        const sampleCount = sampleCountByProblemId.get(submission.problemId) ?? 0;
        if (
            !existing ||
            scoreSubmission(submission.results, getContestProblemPoints(contest, submission.problemId), sampleCount) >
                scoreSubmission(
                    existing.results,
                    getContestProblemPoints(contest, existing.problemId),
                    sampleCountByProblemId.get(existing.problemId) ?? 0,
                )
        ) {
            bestByUserAndProblem.set(key, submission);
        }
    }

    const rowsByUser = new Map<string, ScoreboardRow>();
    for (const submission of bestByUserAndProblem.values()) {
        const userId = submission.userId.toString();
        const row = rowsByUser.get(userId) ?? {
            elapsedMs: 0,
            email: emailByUserId.get(userId) ?? "Unknown User",
            points: 0,
            solved: 0,
            userId,
        };
        const sampleCount = sampleCountByProblemId.get(submission.problemId) ?? 0;
        const points = scoreSubmission(submission.results, getContestProblemPoints(contest, submission.problemId), sampleCount);
        row.points += points;
        if (isSolved(submission.results, sampleCount)) {
            row.solved++;
        }
        const scoredAt = submission.completedAt ?? submission.createdAt;
        if (scoredAt && (!row.lastScoredAt || scoredAt > row.lastScoredAt)) {
            row.lastScoredAt = scoredAt;
        }
        row.elapsedMs = Math.max(row.elapsedMs, getElapsedMs(contest, attemptByUserId.get(userId), scoredAt));
        rowsByUser.set(userId, row);
    }

    return [...rowsByUser.values()].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
        return a.email.localeCompare(b.email);
    });
}

export async function saveContestWithProblems(input: ContestSaveInput): Promise<IContest> {
    const accessType = input.accessType ?? "public";
    const clubId = input.clubId?.trim() ?? null;
    const scopedContest = { clubId: accessType === "club" ? clubId : null, id: input.id };
    const contestStorageId = getContestStorageId(scopedContest);
    if (accessType === "club") {
        if (!clubId) {
            throw new Error("Restricted contests require a class or club.");
        }
        const clubExists = await ClassClub.exists({ id: clubId });
        if (!clubExists) {
            throw new Error("Class or club does not exist.");
        }
    }

    const problemIds = [...input.existingProblemIds];
    if (input.existingProblemIds.length + input.inlineProblems.length > MAX_PROBLEMS_PER_CONTEST) {
        throw new Error(`Contests can include up to ${MAX_PROBLEMS_PER_CONTEST.toString()} problems.`);
    }

    const filter = contestScopeFilter(input.id, accessType === "club" ? clubId : null);
    const existingContest = await Contest.findOne(filter).select("_id").lean();
    if (!existingContest && accessType === "club" && clubId) {
        const contestCount = await Contest.countDocuments({ accessType: "club", clubId });
        if (contestCount >= MAX_CONTESTS_PER_CLUB) {
            throw new Error(`Clubs can create up to ${MAX_CONTESTS_PER_CLUB.toString()} contests.`);
        }
    }

    for (const problem of input.inlineProblems) {
        const problemUpdate = { ...problem };
        delete problemUpdate.points;
        await saveProblemWithTestcases({
            ...problemUpdate,
            contestID: contestStorageId,
            isPrivate: problem.isPrivate ?? false,
            whitelist: problem.whitelist ?? [],
        });
        problemIds.push(problem.id);
    }

    const uniqueProblemIds = [...new Set(problemIds)];
    if (uniqueProblemIds.length > MAX_PROBLEMS_PER_CONTEST) {
        throw new Error(`Contests can include up to ${MAX_PROBLEMS_PER_CONTEST.toString()} problems.`);
    }
    const problemPoints = normalizeProblemPoints(uniqueProblemIds, input.problemPoints);
    const inlineProblemIds = new Set(input.inlineProblems.map((problem) => problem.id));
    const existingGlobalProblemIds = uniqueProblemIds.filter((problemId) => !inlineProblemIds.has(problemId));
    const existingProblemCount = await Problem.countDocuments({
        $or: [{ contestID: null }, { contestID: { $exists: false } }],
        id: { $in: existingGlobalProblemIds },
    });
    if (existingProblemCount !== existingGlobalProblemIds.length) {
        throw new Error("One or more contest problems do not exist.");
    }

    const contest = await Contest.findOneAndUpdate(
        filter,
        {
            $set: {
                accessType,
                clubId: accessType === "club" ? clubId : null,
                ...(input.createdBy ? { createdBy: input.createdBy } : {}),
                ...(input.timingMode === "personal" ? { durationMinutes: input.durationMinutes } : {}),
                endTime: input.endTime,
                id: input.id,
                name: input.name,
                problemIds: uniqueProblemIds,
                problemPoints,
                startTime: input.startTime,
                timingMode: input.timingMode,
            },
            $unset: {
                ...(input.timingMode === "global" ? { durationMinutes: "" } : {}),
                problems: "",
            },
        },
        { new: true, setDefaultsOnInsert: true, upsert: true },
    );

    return contest;
}

export async function startPersonalContest(contest: IContest, userId: Types.ObjectId, now = new Date()): Promise<IContestAttempt> {
    if (contest.timingMode !== "personal") {
        throw new Error("This contest does not use personal timers.");
    }
    if (now < contest.startTime) {
        throw new Error("Contest is not open yet.");
    }
    if (now >= contest.endTime) {
        throw new Error("Contest is closed for new starts.");
    }
    if (!contest.durationMinutes || contest.durationMinutes <= 0) {
        throw new Error("Contest duration is not configured.");
    }

    const contestStorageId = getContestStorageId(contest);
    const existing = await ContestAttempt.findOne({ contestId: contestStorageId, userId });
    if (existing) {
        return existing;
    }

    return ContestAttempt.create({
        contestId: contestStorageId,
        endsAt: new Date(now.getTime() + contest.durationMinutes * 60 * 1000),
        startedAt: now,
        userId,
    });
}

function countAcceptedTests(results: IResult[]): number {
    return results.filter((result) => result.status === "AC").length;
}

async function getContestSampleCounts(contest: IContest): Promise<Map<string, number>> {
    const counts = await Promise.all(
        (contest.problemIds ?? []).map(async (problemId) => {
            const problem = await getContestProblem(contest, problemId, true);
            return [problemId, problem?.numSampleTestcases ?? 0] as const;
        }),
    );

    return new Map(counts);
}

function getElapsedMs(contest: IContest, attempt: IContestAttempt | undefined, scoredAt: Date | undefined): number {
    if (!scoredAt) {
        return Number.MAX_SAFE_INTEGER;
    }

    const startsAt = contest.timingMode === "personal" ? attempt?.startedAt : contest.startTime;
    if (!startsAt) {
        return Number.MAX_SAFE_INTEGER;
    }

    return Math.max(0, scoredAt.getTime() - startsAt.getTime());
}

async function getPersonalContestState(contest: IContest, userId: Types.ObjectId | undefined, now: Date): Promise<ContestState> {
    const attempt = userId ? await ContestAttempt.findOne({ contestId: getContestStorageId(contest), userId }).lean<IContestAttempt>() : undefined;
    const canStart = Boolean(userId && !attempt && now >= contest.startTime && now < contest.endTime);
    const canSubmitForScore = Boolean(attempt && now < attempt.endsAt);
    const canViewProblems = Boolean(attempt ?? now >= contest.endTime);
    const endsAt = attempt?.endsAt ?? contest.endTime;

    return {
        ...(attempt ? { attempt } : {}),
        canStart,
        canSubmitForScore,
        canViewProblems,
        endsAt,
        isBeforeOpen: now < contest.startTime,
        isClosedForNewStarts: now >= contest.endTime,
        now,
        startsAt: attempt?.startedAt ?? contest.startTime,
        status: canSubmitForScore
            ? "active"
            : canStart
              ? "available"
              : canViewProblems
                ? "closed"
                : now < contest.startTime
                  ? "not-started"
                  : "unstarted",
    };
}

function getScoredResults(results: IResult[], sampleCount: number): IResult[] {
    return results.slice(Math.max(0, sampleCount));
}

function isSolved(results: IResult[], sampleCount: number): boolean {
    const scoredResults = getScoredResults(results, sampleCount);
    return scoredResults.length > 0 && countAcceptedTests(scoredResults) === scoredResults.length;
}

function normalizeProblemPoints(problemIds: string[], inputPoints: Record<string, number> | undefined): Record<string, number> {
    return Object.fromEntries(
        problemIds.map((problemId) => {
            const points = readProblemPoints(inputPoints, problemId);
            return [problemId, points ?? defaultProblemPoints];
        }),
    );
}

function readProblemPoints(pointsMap: Map<string, number> | Record<string, number> | undefined, problemId: string): null | number {
    const rawValue = pointsMap instanceof Map ? pointsMap.get(problemId) : pointsMap?.[problemId];
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function scoreSubmission(results: IResult[], maxPoints: number, sampleCount: number): number {
    const scoredResults = getScoredResults(results, sampleCount);
    if (scoredResults.length === 0) {
        return 0;
    }

    return Math.round((countAcceptedTests(scoredResults) / scoredResults.length) * maxPoints);
}
