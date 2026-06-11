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
import { Types } from "mongoose";
import validator from "validator";

import { authenticateToken, authenticateTokenOptional } from "../middleware/authenticate";
import { ClassClub, Contest, User } from "../models";
import { canManageClub } from "../services/clubs";
import { ContestSaveBody, getEditableContest, isExpectedContestSaveError, parseContestSaveBody } from "../services/contest-editor";
import { contestScopeFilter } from "../services/contest-scope";
import { canAccessContest, getContestState, getScoreboard, saveContestWithProblems, startPersonalContest } from "../services/contests";
import { IContest } from "../types/models";

const router = express.Router();
export default router;

async function canEditContest(contest: IContest, userId: Types.ObjectId): Promise<boolean> {
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

router.get("/editor/:contestID", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const contestID = validator.escape(req.params.contestID.trim());
    const clubId = typeof req.query.club === "string" ? validator.escape(req.query.club.trim()) : null;
    const contest = await Contest.findOne(contestScopeFilter(contestID, clubId)).lean();
    if (!contest) {
        return res.status(404).json({ message: "Contest not found" });
    }
    if (!(await canEditContest(contest, req.user.id))) {
        return res.status(403).json({ message: "Only the club owner can edit this contest" });
    }

    return res.json({ contest: await getEditableContest(contestID, clubId) });
});

router.post("/save", authenticateToken, async (req: express.Request<unknown, unknown, ContestSaveBody>, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const input = parseContestSaveBody(req.body, req.user.id);
        const user = await User.findById(req.user.id).select("admin").lean();
        const existingContest = await Contest.findOne(contestScopeFilter(input.id, input.accessType === "club" ? input.clubId : null)).lean();
        if (existingContest && !(await canEditContest(existingContest, req.user.id))) {
            return res.status(403).json({ message: "Only the club owner can edit this contest" });
        }
        if (!user?.admin) {
            if (input.accessType !== "club" || !input.clubId) {
                return res.status(403).json({ message: "Club contests must be attached to one of your clubs" });
            }
            const club = await ClassClub.findOne({ id: input.clubId });
            if (!club || !(await canManageClub(club, req.user.id))) {
                return res.status(403).json({ message: "Only the club owner can create contests for this club" });
            }
        }

        await saveContestWithProblems(input);
        return res.status(200).json({ message: "Successfully saved contest!" });
    } catch (error) {
        console.error("Failed to save contest:", error);
        const message =
            error instanceof Error && isExpectedContestSaveError(error.message)
                ? error.message
                : "Failed to save contest. Please check the contest problems and try again.";
        return res.status(400).json({ message });
    }
});

router.get("/:contestID/scoreboard", authenticateTokenOptional, async (req, res) => {
    const contestID = validator.escape(req.params.contestID.trim());
    const clubId = typeof req.query.club === "string" ? validator.escape(req.query.club.trim()) : null;
    const contest = await Contest.findOne(contestScopeFilter(contestID, clubId));
    if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
    }
    if (!(await canAccessContest(contest, req.user?.id))) {
        return res.status(403).json({ error: "Contest is restricted" });
    }

    const scoreboard = await getScoreboard(contest);
    return res.json({ scoreboard });
});

router.get("/:contestID/state", authenticateTokenOptional, async (req, res) => {
    const contestID = validator.escape(req.params.contestID.trim());
    const clubId = typeof req.query.club === "string" ? validator.escape(req.query.club.trim()) : null;
    const contest = await Contest.findOne(contestScopeFilter(contestID, clubId));
    if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
    }
    if (!(await canAccessContest(contest, req.user?.id))) {
        return res.status(403).json({ error: "Contest is restricted" });
    }

    const state = await getContestState(contest, req.user?.id);
    return res.json({ state });
});

router.post("/:contestID/start", authenticateToken, async (req, res) => {
    const contestID = validator.escape(req.params.contestID.trim());
    const clubId = typeof req.query.club === "string" ? validator.escape(req.query.club.trim()) : null;
    const contest = await Contest.findOne(contestScopeFilter(contestID, clubId));
    if (!contest) {
        return res.status(404).json({ error: "Contest not found" });
    }
    try {
        if (!req.user) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        if (!(await canAccessContest(contest, req.user.id))) {
            return res.status(403).json({ error: "Contest is restricted" });
        }
        const attempt = await startPersonalContest(contest, req.user.id);
        return res.json({ attempt });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start contest";
        return res.status(400).json({ error: message });
    }
});
