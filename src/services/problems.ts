import { FilterQuery, Types } from "mongoose";

import { Problem, ProblemTestcase, User } from "../models";
import { IContest, IProblem, IProblemWithTestcases } from "../types/models";
import { getContestStorageId } from "./contest-scope";

export type ProblemUpdateInput = Omit<IProblemWithTestcases, "whitelist"> & {
    whitelist?: (string | Types.ObjectId)[];
};

type ProblemDocumentShape = IProblem & {
    _id: Types.ObjectId;
    inputTestcases?: string[];
    outputTestcases?: string[];
};

export async function dropLegacyGlobalProblemIdIndex(): Promise<boolean> {
    return dropIndexIfExists(Problem.collection, "id_1");
}

export async function dropLegacyProblemTestcaseIndexes(): Promise<number> {
    const legacyIndexes = ["isSample_1_problemId_1", "order_1_problemId_1", "problemId_1_isSample_1", "problemId_1_order_1"];
    const dropped = await Promise.all(legacyIndexes.map((indexName) => dropIndexIfExists(ProblemTestcase.collection, indexName)));

    return dropped.filter(Boolean).length;
}

export async function getContestProblem(
    contest: IContest,
    problemId: string,
    includeHiddenTestcases: boolean,
): Promise<IProblemWithTestcases | null> {
    const problemIds = getContestProblemIds(contest);
    if (problemIds.length > 0 && !problemIds.includes(problemId)) {
        return null;
    }

    const contestStorageId = getContestStorageId(contest);
    const contestProblem = await getProblemWithTestcases(problemId, includeHiddenTestcases, contestStorageId);
    if (contestProblem) {
        return contestProblem;
    }

    const globalProblem = await getProblemWithTestcases(problemId, includeHiddenTestcases);
    if (globalProblem) {
        return { ...globalProblem, contestID: contestStorageId };
    }

    const legacyProblem = contest.problems?.find((problem) => problem.id === problemId);
    if (!legacyProblem) {
        return null;
    }

    return filterProblemTestcases(legacyProblem, includeHiddenTestcases);
}

export function getContestProblemIds(contest: IContest): string[] {
    const problemIds = contest.problemIds ?? [];
    if (problemIds.length > 0) {
        return problemIds;
    }

    return contest.problems?.map((problem) => problem.id) ?? [];
}

export async function getContestProblems(contest: IContest, includeHiddenTestcases: boolean): Promise<IProblemWithTestcases[]> {
    const problemIds = getContestProblemIds(contest);
    if (problemIds.length === 0) {
        return contest.problems?.map((problem) => filterProblemTestcases(problem, includeHiddenTestcases)) ?? [];
    }

    const problems = await Promise.all(problemIds.map((problemId) => getContestProblem(contest, problemId, includeHiddenTestcases)));
    return problems.filter((problem): problem is IProblemWithTestcases => problem !== null);
}

export async function getProblemWithTestcases(
    problemId: string,
    includeHiddenTestcases: boolean,
    contestId?: null | string,
): Promise<IProblemWithTestcases | null> {
    const normalizedContestId = contestId ?? null;
    const problem = await Problem.findOne(problemScopeFilter(problemId, normalizedContestId)).lean<ProblemDocumentShape>();
    if (!problem) {
        return null;
    }

    const testcases = await ProblemTestcase.find({
        contestId: normalizedContestId,
        problemId,
        ...(includeHiddenTestcases ? {} : { isSample: true }),
    })
        .sort({ order: 1 })
        .lean();

    if (testcases.length > 0) {
        return {
            ...problem,
            inputTestcases: testcases.map((testcase) => testcase.input),
            outputTestcases: testcases.map((testcase) => testcase.output),
        };
    }

    return filterProblemTestcases(
        {
            ...problem,
            inputTestcases: problem.inputTestcases ?? [],
            outputTestcases: problem.outputTestcases ?? [],
        },
        includeHiddenTestcases,
    );
}

export async function getVisibleProblemQuery(userId?: Types.ObjectId): Promise<FilterQuery<IProblem>> {
    const query: FilterQuery<IProblem> = {
        $and: [globalProblemScopeFilter()],
        $or: [{ isPrivate: { $ne: true } }],
    };

    if (!userId) {
        return query;
    }

    const isAdmin = (await User.findById(userId).select("admin"))?.admin ?? false;
    if (isAdmin) {
        return globalProblemScopeFilter();
    }

    query.$or?.push({
        isPrivate: true,
        whitelist: { $in: [userId] },
    });
    return query;
}

export async function migrateLegacyProblemTestcases(): Promise<number> {
    const legacyProblems = await Problem.find({
        inputTestcases: { $exists: true },
        outputTestcases: { $exists: true },
    }).lean<ProblemDocumentShape[]>();

    let migrated = 0;
    for (const problem of legacyProblems) {
        const contestId = problem.contestID ?? null;
        const inputTestcases = problem.inputTestcases ?? [];
        const outputTestcases = problem.outputTestcases ?? [];
        if (inputTestcases.length === 0 || inputTestcases.length !== outputTestcases.length) {
            continue;
        }

        const existingTestcaseCount = await ProblemTestcase.countDocuments({ contestId, problemId: problem.id });
        if (existingTestcaseCount === 0) {
            await replaceProblemTestcases(problem.id, inputTestcases, outputTestcases, problem.numSampleTestcases, contestId);
        }

        await Problem.updateOne(
            { _id: problem._id },
            {
                $set: { contestID: contestId },
                $unset: {
                    inputTestcases: "",
                    outputTestcases: "",
                },
            },
        );
        migrated++;
    }

    return migrated;
}

export async function replaceProblemTestcases(
    problemId: string,
    inputTestcases: string[],
    outputTestcases: string[],
    numSampleTestcases: number,
    contestId?: null | string,
): Promise<void> {
    const normalizedContestId = contestId ?? null;
    await ProblemTestcase.deleteMany({ contestId: normalizedContestId, problemId });
    await ProblemTestcase.insertMany(
        inputTestcases.map((input, order) => ({
            contestId: normalizedContestId,
            input,
            isSample: order < numSampleTestcases,
            order,
            output: outputTestcases[order],
            problemId,
        })),
    );
}

export async function saveProblemWithTestcases(update: ProblemUpdateInput): Promise<IProblem> {
    const contestID = update.contestID ?? null;
    const problem = await Problem.findOneAndUpdate(
        { contestID, id: update.id },
        {
            $set: {
                contestID,
                id: update.id,
                inputFormat: update.inputFormat,
                isPrivate: update.isPrivate ?? false,
                name: update.name,
                numSampleTestcases: update.numSampleTestcases,
                outputFormat: update.outputFormat,
                problemStatement: update.problemStatement,
                whitelist: update.whitelist ?? [],
            },
            $unset: {
                inputTestcases: "",
                outputTestcases: "",
            },
        },
        {
            new: true,
            setDefaultsOnInsert: true,
            upsert: true,
        },
    );

    await replaceProblemTestcases(update.id, update.inputTestcases, update.outputTestcases, update.numSampleTestcases, contestID);
    return problem;
}

async function dropIndexIfExists(collection: typeof Problem.collection, indexName: string): Promise<boolean> {
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

function filterProblemTestcases(problem: IProblemWithTestcases, includeHiddenTestcases: boolean): IProblemWithTestcases {
    if (includeHiddenTestcases) {
        return problem;
    }

    return {
        ...problem,
        inputTestcases: problem.inputTestcases.slice(0, problem.numSampleTestcases),
        outputTestcases: problem.outputTestcases.slice(0, problem.numSampleTestcases),
    };
}

function globalProblemScopeFilter(): FilterQuery<IProblem> {
    return { $or: [{ contestID: null }, { contestID: { $exists: false } }] };
}

function problemScopeFilter(problemId: string, contestId: null | string): FilterQuery<IProblem> {
    if (contestId === null) {
        return {
            id: problemId,
            ...globalProblemScopeFilter(),
        };
    }

    return { contestID: contestId, id: problemId };
}
