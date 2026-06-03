import { FilterQuery, Types } from "mongoose";

import { Problem, ProblemTestcase, User } from "../models";
import { IContest, IProblem, IProblemWithTestcases } from "../types/models";

export type ProblemUpdateInput = Omit<IProblemWithTestcases, "whitelist"> & {
    whitelist?: (string | Types.ObjectId)[];
};

type ProblemDocumentShape = IProblem & {
    inputTestcases?: string[];
    outputTestcases?: string[];
};

export async function getContestProblem(
    contest: IContest,
    problemId: string,
    includeHiddenTestcases: boolean,
): Promise<IProblemWithTestcases | null> {
    const problemIds = getContestProblemIds(contest);
    if (problemIds.length > 0 && !problemIds.includes(problemId)) {
        return null;
    }

    const normalizedProblem = await getProblemWithTestcases(problemId, includeHiddenTestcases);
    if (normalizedProblem) {
        return { ...normalizedProblem, contestID: contest.id };
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

export async function getProblemWithTestcases(problemId: string, includeHiddenTestcases: boolean): Promise<IProblemWithTestcases | null> {
    const problem = await Problem.findOne({ id: problemId }).lean<ProblemDocumentShape>();
    if (!problem) {
        return null;
    }

    const testcases = await ProblemTestcase.find({
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
        $or: [{ isPrivate: { $ne: true } }],
    };

    if (!userId) {
        return query;
    }

    const isAdmin = (await User.findById(userId).select("admin"))?.admin ?? false;
    if (isAdmin) {
        return {};
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
        const inputTestcases = problem.inputTestcases ?? [];
        const outputTestcases = problem.outputTestcases ?? [];
        if (inputTestcases.length === 0 || inputTestcases.length !== outputTestcases.length) {
            continue;
        }

        const existingTestcaseCount = await ProblemTestcase.countDocuments({ problemId: problem.id });
        if (existingTestcaseCount === 0) {
            await replaceProblemTestcases(problem.id, inputTestcases, outputTestcases, problem.numSampleTestcases);
        }

        await Problem.updateOne(
            { id: problem.id },
            {
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
): Promise<void> {
    await ProblemTestcase.deleteMany({ problemId });
    await ProblemTestcase.insertMany(
        inputTestcases.map((input, order) => ({
            input,
            isSample: order < numSampleTestcases,
            order,
            output: outputTestcases[order],
            problemId,
        })),
    );
}

export async function saveProblemWithTestcases(update: ProblemUpdateInput): Promise<IProblem> {
    const problem = await Problem.findOneAndUpdate(
        { id: update.id },
        {
            $set: {
                contestID: update.contestID ?? null,
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

    await replaceProblemTestcases(update.id, update.inputTestcases, update.outputTestcases, update.numSampleTestcases);
    return problem;
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
