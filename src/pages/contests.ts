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

import express from "express";
import fs from "fs";
import { Types } from "mongoose";
import path from "path";

import { sanitizeProblemHtml } from "../lib/sanitize.js";
import { authenticateTokenOptional } from "../middleware/authenticate.js";
import { ClassClub, Contest, User } from "../models.js";
import { canManageClub } from "../services/clubs.js";
import { contestScopeFilter, contestUrl, getContestStorageId } from "../services/contest-scope.js";
import { canAccessContest, getContestProblemPoints, getContestState, getScoreboard } from "../services/contests.js";
import { getContestProblem, getContestProblems } from "../services/problems.js";
import { IContest } from "../types/models.js";

/**
 * Contests Router
 */
const router = express.Router();
export default router;

type ContestPageView = IContest & {
    clubName: null | string;
    href: string;
};

router.get("/contests", authenticateTokenOptional, async (req, res) => {
    const allContests = await Contest.find().lean<IContest[]>();
    const clubNames = await getContestClubNames(allContests);
    const contests: ContestPageView[] = [];
    for (const contest of allContests) {
        if (await canAccessContest(contest, req.user?.id)) {
            contests.push({
                ...contest,
                clubName: contest.clubId ? (clubNames.get(contest.clubId) ?? contest.clubId) : null,
                href: contestUrl(contest),
            });
        }
    }
    res.render("contests", { contests });
});

router.get("/contests/:target", authenticateTokenOptional, async (req, res) => {
    const target = req.params.target;
    const targetPath = path.join(__dirname, "..", "public", "contests", target);
    // send files if they exist
    if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isFile()) {
            res.sendFile(targetPath);
            return;
        }
    }
    const clubId = typeof req.query.club === "string" ? req.query.club : null;
    const contest = await Contest.findOne(contestScopeFilter(target, clubId)).lean<IContest>();
    if (!contest) {
        // redirect if the file doesn't exist
        res.redirect("/contests");
        return;
    }
    if (!(await canAccessContest(contest, req.user?.id))) {
        res.status(403).render("contest-unavailable", {
            contestID: contest.id,
            reason: {
                text: "This contest is limited to members of its class or club.",
                title: "Contest Restricted",
            },
            title: "Contest Restricted",
        });
        return;
    }
    const state = await getContestState(contest, req.user?.id);
    const problems = state.canViewProblems
        ? (await getContestProblems(contest, false)).map((problem) => ({
              ...problem,
              points: getContestProblemPoints(contest, problem.id),
          }))
        : [];
    const scoreboard = (await getScoreboard(contest)).map((row) => ({
        ...row,
        elapsedLabel: formatElapsed(row.elapsedMs),
    }));
    const clubName = contest.clubId ? ((await ClassClub.findOne({ id: contest.clubId }).select("name").lean())?.name ?? contest.clubId) : null;
    const editHref = (await canEditContestPage(contest, req.user?.id))
        ? contest.clubId
            ? `/clubs/${encodeURIComponent(contest.clubId)}/contests/${encodeURIComponent(contest.id)}/edit`
            : `/admin/add-contest?contest=${encodeURIComponent(contest.id)}`
        : null;

    res.render("contest", {
        backArrow: { href: "/contests", text: "Back to Contest List" },
        contest: { ...contest, clubName, editHref, href: contestUrl(contest), problems, storageId: getContestStorageId(contest) },
        mainSection: { width: "max-w-6xl" },
        scoreboard,
        state,
        title: contest.name,
    });
});

async function canEditContestPage(contest: IContest, userId: Types.ObjectId | undefined): Promise<boolean> {
    if (!userId) {
        return false;
    }
    const user = await User.findById(userId).select("admin").lean();
    if (user?.admin) {
        return true;
    }
    if (!contest.clubId) {
        return false;
    }
    const club = await ClassClub.findOne({ id: contest.clubId });
    return Boolean(club && (await canManageClub(club, userId)));
}

function formatElapsed(elapsedMs: number): string {
    if (!Number.isFinite(elapsedMs) || elapsedMs === Number.MAX_SAFE_INTEGER) {
        return "-";
    }

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours.toString()}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
}

async function getContestClubNames(contests: IContest[]): Promise<Map<string, string>> {
    const clubIds = [...new Set(contests.map((contest) => contest.clubId).filter((clubId): clubId is string => Boolean(clubId)))];
    if (clubIds.length === 0) {
        return new Map();
    }

    const clubs = await ClassClub.find({ id: { $in: clubIds } })
        .select("id name")
        .lean();
    return new Map(clubs.map((club) => [club.id, club.name]));
}

router.get("/contests/:contestID/:problemID", authenticateTokenOptional, async (req, res) => {
    const { contestID, problemID } = req.params;
    const contestDir = path.join(__dirname, "..", "public", "contests", contestID);
    if (fs.existsSync(path.join(contestDir, problemID))) {
        if (fs.statSync(path.join(contestDir, problemID)).isFile()) {
            res.sendFile(path.join(contestDir, problemID));
            return;
        }
    }
    const clubId = typeof req.query.club === "string" ? req.query.club : null;
    const contest: IContest | null = await Contest.findOne(contestScopeFilter(contestID, clubId)).lean<IContest>();
    if (!contest) {
        res.redirect("/contests");
        return;
    }
    if (!(await canAccessContest(contest, req.user?.id))) {
        res.status(403).render("contest-unavailable", {
            contestID: contest.id,
            reason: {
                text: "This problem is part of a restricted contest.",
                title: "Contest Restricted",
            },
            title: "Contest Restricted",
        });
        return;
    }
    const state = await getContestState(contest, req.user?.id);
    if (!state.canViewProblems) {
        res.render("contest-unavailable", {
            contestID: contest.id,
            reason: {
                text: state.canStart
                    ? "Start this contest from the contest page to unlock the problems."
                    : `The contest opens at ${contest.startTime.toLocaleString()}`,
                title: state.canStart ? "Contest Not Started" : "Contest Not Open",
            },
            title: "Contest Unavailable",
        });
        return;
    }
    const problem = await getContestProblem(contest, problemID, false);
    if (!problem?.contestID) {
        res.redirect("../");
        return;
    }

    res.render("problem", {
        backArrow: { href: contestUrl(contest), text: "Back to Contest" },
        head: `<script src="https://ajaxorg.github.io/ace-builds/src-min-noconflict/ace.js" type="text/javascript" charset="utf-8"></script>
                   <script type="module" src="/problems/problem-script.js" defer></script>
                   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css" />
                   <link rel="stylesheet" href="/problems/problem-style.css"></link>`,
        problem: {
            ...problem,
            inputFormat: sanitizeProblemHtml(problem.inputFormat),
            outputFormat: sanitizeProblemHtml(problem.outputFormat),
            problemStatement: sanitizeProblemHtml(problem.problemStatement),
        },
        title: problem.name,
    });
});
