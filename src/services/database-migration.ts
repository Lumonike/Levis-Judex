import mongoose, { Types } from "mongoose";

import { Contest, Problem, ProblemTestcase, Submission, User } from "../models";
import { IProblemWithTestcases, IResult } from "../types/models";
import { migrateLegacyProblemTestcases, replaceProblemTestcases } from "./problems";

export interface MigrationResult {
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
    problems?: IProblemWithTestcases[];
}

interface LegacyUserDocument {
    _id: Types.ObjectId;
    code?: Map<string, string> | Record<string, string>;
    results?: Map<string, IResult[]> | Record<string, IResult[]>;
}

export async function migrateDatabase(): Promise<MigrationResult> {
    const problemTestcasesMigrated = await migrateLegacyProblemTestcases();
    const contests = await migrateLegacyContests();
    const submissions = await migrateLegacyUserSubmissions();

    return {
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
            importedProblems += await importLegacyContestProblem(problem);
        }

        await Contest.updateOne(
            { _id: contest._id },
            {
                $set: { problemIds },
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

export async function runDatabaseMigrationFromEnv(): Promise<MigrationResult> {
    await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/authdb");
    try {
        return await migrateDatabase();
    } finally {
        await mongoose.disconnect();
    }
}

async function importLegacyContestProblem(problem: IProblemWithTestcases): Promise<number> {
    const existingProblem = await Problem.findOne({ id: problem.id }).select("_id");
    if (!existingProblem) {
        await Problem.create({
            contestID: problem.contestID ?? null,
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

    const existingTestcaseCount = await ProblemTestcase.countDocuments({ problemId: problem.id });
    if (existingTestcaseCount === 0 && problem.inputTestcases.length === problem.outputTestcases.length) {
        await replaceProblemTestcases(problem.id, problem.inputTestcases, problem.outputTestcases, problem.numSampleTestcases);
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
