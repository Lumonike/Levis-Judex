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
