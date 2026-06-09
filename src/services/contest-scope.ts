import { IContest } from "../types/models";

export function contestScopeFilter(contestId: string, clubId?: null | string): Record<string, unknown> {
    if (clubId) {
        return { clubId, id: contestId };
    }

    return {
        $or: [{ clubId: null }, { clubId: { $exists: false } }],
        id: contestId,
    };
}

export function contestUrl(contest: Pick<IContest, "clubId" | "id">): string {
    const query = contest.clubId ? `?club=${encodeURIComponent(contest.clubId)}` : "";
    return `/contests/${encodeURIComponent(contest.id)}${query}`;
}

export function getContestStorageId(contest: Pick<IContest, "clubId" | "id">): string {
    return contest.clubId ? `club:${contest.clubId}:${contest.id}` : contest.id;
}

export function parseContestStorageId(storageId: string): { clubId: null | string; id: string } {
    const match = /^club:([^:]+):(.+)$/.exec(storageId);
    if (!match) {
        return { clubId: null, id: storageId };
    }

    return { clubId: match[1], id: match[2] };
}
