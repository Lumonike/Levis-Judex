import mongoose, { Types } from "mongoose";

import { createClubInviteCode } from "../lib/invite-codes";
import { ClassClub, Contest, ContestAttempt, Problem, ProblemTestcase, Submission, User } from "../models";
import { IProblemWithTestcases, IResult } from "../types/models";
import { getContestStorageId } from "./contest-scope";
import { dropLegacyGlobalProblemIdIndex, dropLegacyProblemTestcaseIndexes, migrateLegacyProblemTestcases, replaceProblemTestcases } from "./problems";

export interface MigrationResult {
    clubs: {
        inviteCodesMigrated: number;
        openClubsClosed: number;
        rosterFieldsMigrated: number;
    };
    contests: {
        importedProblems: number;
        migrated: number;
    };
    problems: {
        testcasesMigrated: number;
    };
    submissions: {
        migrated: number;
    };
}

interface LegacyContestDocument {
    _id: Types.ObjectId;
    id: string;
    problems?: IProblemWithTestcases[];
}

interface LegacyUserDocument {
    _id: Types.ObjectId;
    code?: Map<string, string> | Record<string, string>;
    results?: Map<string, IResult[]> | Record<string, IResult[]>;
}

export async function dropLegacyContestProblemIndexes(): Promise<number> {
    const legacyIndexes = ["id_1", "problems.id_1"];
    const dropped = await Promise.all(legacyIndexes.map((indexName) => dropIndexIfExists(Contest.collection, indexName)));

    return dropped.filter(Boolean).length;
}

export async function migrateClubContestStorageKeys(): Promise<number> {
    const contests = await Contest.find({ accessType: "club", clubId: { $type: "string" } }).lean();
    let migrated = 0;

    for (const contest of contests) {
        const oldContestId = contest.id;
        const storageId = getContestStorageId(contest);
        if (oldContestId === storageId) {
            continue;
        }

        const [problems, testcases, submissions, attempts] = await Promise.all([
            Problem.updateMany({ contestID: oldContestId }, { $set: { contestID: storageId } }),
            ProblemTestcase.updateMany({ contestId: oldContestId }, { $set: { contestId: storageId } }),
            Submission.updateMany({ contestId: oldContestId }, { $set: { contestId: storageId } }),
            ContestAttempt.updateMany({ contestId: oldContestId }, { $set: { contestId: storageId } }),
        ]);
        migrated += problems.modifiedCount + testcases.modifiedCount + submissions.modifiedCount + attempts.modifiedCount;
    }

    return migrated;
}

export async function migrateClubInviteCodes(): Promise<number> {
    const clubs = await ClassClub.find({
        $or: [{ inviteCode: { $exists: false } }, { inviteCode: "" }, { inviteCode: null }],
    }).select("_id inviteCode");
    let migrated = 0;

    for (const club of clubs) {
        let inviteCode = createClubInviteCode();
        while (await ClassClub.exists({ inviteCode })) {
            inviteCode = createClubInviteCode();
        }
        club.inviteCode = inviteCode;
        await club.save();
        migrated++;
    }

    return migrated;
}

export async function migrateClubRosterFields(): Promise<number> {
    const [memberEmails, inviteEmails, requestEmails, joinPolicy] = await Promise.all([
        ClassClub.updateMany({ memberEmails: { $exists: false } }, { $set: { memberEmails: [] } }),
        ClassClub.updateMany({ inviteEmails: { $exists: false } }, { $set: { inviteEmails: [] } }),
        ClassClub.updateMany({ requestEmails: { $exists: false } }, { $set: { requestEmails: [] } }),
        ClassClub.updateMany({ joinPolicy: { $exists: false } }, { $set: { joinPolicy: "invite" } }),
    ]);
    return memberEmails.modifiedCount + inviteEmails.modifiedCount + requestEmails.modifiedCount + joinPolicy.modifiedCount;
}

export async function migrateDatabase(): Promise<MigrationResult> {
    await dropLegacyGlobalProblemIdIndex();
    await dropLegacyContestProblemIndexes();
    await dropLegacyProblemTestcaseIndexes();
    const rosterFieldsMigrated = await migrateClubRosterFields();
    const inviteCodesMigrated = await migrateClubInviteCodes();
    const openClubsClosed = await migrateOpenClubsToInviteOnly();
    const problemTestcasesMigrated = await migrateLegacyProblemTestcases();
    const contests = await migrateLegacyContests();
    await migrateClubContestStorageKeys();
    const submissions = await migrateLegacyUserSubmissions();

    return {
        clubs: {
            inviteCodesMigrated,
            openClubsClosed,
            rosterFieldsMigrated,
        },
        contests,
        problems: {
            testcasesMigrated: problemTestcasesMigrated,
        },
        submissions: {
            migrated: submissions,
        },
    };
}

export async function migrateLegacyContests(): Promise<MigrationResult["contests"]> {
    const legacyContests = await Contest.find({ problems: { $exists: true, $ne: [] } }).lean<LegacyContestDocument[]>();
    let importedProblems = 0;
    let migrated = 0;

    for (const contest of legacyContests) {
        const problems = contest.problems ?? [];
        if (problems.length === 0) {
            continue;
        }

        const problemIds: string[] = [];
        for (const problem of problems) {
            problemIds.push(problem.id);
            importedProblems += await importLegacyContestProblem({ ...problem, contestID: problem.contestID ?? contest.id });
        }

        await Contest.updateOne(
            { _id: contest._id },
            {
                $set: {
                    problemIds,
                    problemPoints: Object.fromEntries(problemIds.map((problemId) => [problemId, 100])),
                },
                $unset: { problems: "" },
            },
        );
        migrated++;
    }

    return { importedProblems, migrated };
}

export async function migrateLegacyUserSubmissions(): Promise<number> {
    const users = await User.collection
        .find<LegacyUserDocument>({
            $or: [{ code: { $exists: true } }, { results: { $exists: true } }],
        })
        .toArray();
    let migrated = 0;

    for (const user of users) {
        const codeEntries = normalizeLegacyMap(user.code);
        const resultEntries = normalizeLegacyMap(user.results);
        const combinedKeys = new Set([...codeEntries.keys(), ...resultEntries.keys()]);

        for (const combinedKey of combinedKeys) {
            const code = codeEntries.get(combinedKey);
            if (typeof code !== "string" || code.length === 0) {
                continue;
            }

            const parsedKey = parseLegacySubmissionKey(combinedKey);
            const legacyKey = `${user._id.toString()}:${combinedKey}`;
            const result = resultEntries.get(combinedKey);

            const created = await Submission.updateOne(
                { legacyKey },
                {
                    $setOnInsert: {
                        code,
                        completedAt: new Date(0),
                        contestId: parsedKey.contestId,
                        legacyKey,
                        problemId: parsedKey.problemId,
                        results: Array.isArray(result) ? result : [],
                        status: "completed",
                        userId: user._id,
                    },
                },
                { upsert: true },
            );

            if (created.upsertedCount > 0) {
                migrated++;
            }
        }

        await User.collection.updateOne({ _id: user._id }, { $unset: { code: "", results: "" } });
    }

    return migrated;
}

export async function migrateOpenClubsToInviteOnly(): Promise<number> {
    const result = await ClassClub.updateMany({ joinPolicy: "open" }, { $set: { joinPolicy: "invite" } });
    return result.modifiedCount;
}

export async function runDatabaseMigrationFromEnv(): Promise<MigrationResult> {
    await mongoose.connect(process.env.MONGODB_URI ?? process.env.MONGO_URI ?? "mongodb://localhost:27017/authdb");
    try {
        return await migrateDatabase();
    } finally {
        await mongoose.disconnect();
    }
}

async function dropIndexIfExists(collection: typeof Contest.collection, indexName: string): Promise<boolean> {
    try {
        await collection.dropIndex(indexName);
        return true;
    } catch (error) {
        if (error instanceof Error && (error.message.includes("index not found") || error.message.includes("index not found with name"))) {
            return false;
        }
        return false;
    }
}

async function importLegacyContestProblem(problem: IProblemWithTestcases): Promise<number> {
    const contestID = problem.contestID ?? null;
    const existingProblem = await Problem.findOne({ contestID, id: problem.id }).select("_id");
    if (!existingProblem) {
        await Problem.create({
            contestID,
            id: problem.id,
            inputFormat: problem.inputFormat,
            isPrivate: problem.isPrivate ?? false,
            name: problem.name,
            numSampleTestcases: problem.numSampleTestcases,
            outputFormat: problem.outputFormat,
            problemStatement: problem.problemStatement,
            whitelist: problem.whitelist ?? [],
        });
    }

    const existingTestcaseCount = await ProblemTestcase.countDocuments({ contestId: contestID, problemId: problem.id });
    if (existingTestcaseCount === 0 && problem.inputTestcases.length === problem.outputTestcases.length) {
        await replaceProblemTestcases(problem.id, problem.inputTestcases, problem.outputTestcases, problem.numSampleTestcases, contestID);
    }

    return existingProblem ? 0 : 1;
}

function normalizeLegacyMap<T>(value: Map<string, T> | Record<string, T> | undefined): Map<string, T> {
    if (!value) {
        return new Map();
    }

    if (value instanceof Map) {
        return value;
    }

    return new Map(Object.entries(value));
}

function parseLegacySubmissionKey(combinedKey: string): { contestId: null | string; problemId: string } {
    const separatorIndex = combinedKey.indexOf(":");
    if (separatorIndex === -1) {
        return { contestId: null, problemId: combinedKey };
    }

    return {
        contestId: combinedKey.slice(0, separatorIndex),
        problemId: combinedKey.slice(separatorIndex + 1),
    };
}
