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
import validator from "validator";

import { authenticateToken } from "../middleware/authenticate";
import { ClassClub, Contest } from "../models";
import { canManageClub, getClubRole } from "../services/clubs";
import { contestScopeFilter } from "../services/contest-scope";
import { IClassClub } from "../types/models";

const router = express.Router();
export default router;

router.get("/clubs", authenticateToken, (req, res) => {
    res.render("clubs", {
        backArrow: { href: "/", text: "Back to Home" },
        head: `<script type="module" src="/clubs/clubs.js" defer></script>`,
        mainSection: { unframed: true, width: "max-w-7xl" },
        title: "Classes and Clubs",
    });
});

router.get("/clubs/:clubID/add-contest", authenticateToken, async (req, res) => {
    if (!req.user) {
        res.status(403).render("contest-unavailable", {
            message: "Please log in to create contests.",
            title: "Unauthorized",
        });
        return;
    }

    const clubID = validator.escape(req.params.clubID.trim());
    const club = await ClassClub.findOne({ id: clubID }).lean<IClassClub>();
    if (!club || !(await canManageClub(club, req.user.id))) {
        res.status(403).render("contest-unavailable", {
            message: "Only the club owner can create contests for this club.",
            title: "Unauthorized",
        });
        return;
    }

    res.render("admin/add-contest", {
        backArrow: { href: "/clubs", text: "Back to Clubs" },
        contestEditorConfig: {
            clubsUrl: "/api/clubs/owned",
            getContestUrl: "/api/contests/editor/{id}",
            lockedAccessType: "club",
            lockedClubId: club.id,
            saveUrl: "/api/contests/save",
        },
        head: `<script type="module" src="/admin/add-contest/add-contest.js" defer></script>`,
        mainSection: { unframed: true, width: "max-w-7xl" },
        title: `Create Contest for ${club.name}`,
    });
});

router.get("/clubs/:clubID/contests/:contestID/edit", authenticateToken, async (req, res) => {
    if (!req.user) {
        res.status(403).render("contest-unavailable", {
            message: "Please log in to edit contests.",
            title: "Unauthorized",
        });
        return;
    }

    const clubID = validator.escape(req.params.clubID.trim());
    const contestID = validator.escape(req.params.contestID.trim());
    const club = await ClassClub.findOne({ id: clubID }).lean<IClassClub>();
    const contest = await Contest.findOne(contestScopeFilter(contestID, clubID)).lean();
    if (!club || !contest || !(await canManageClub(club, req.user.id))) {
        res.status(403).render("contest-unavailable", {
            message: "Only the club owner can edit contests for this club.",
            title: "Unauthorized",
        });
        return;
    }

    res.render("admin/add-contest", {
        backArrow: { href: `/clubs/${encodeURIComponent(club.id)}`, text: "Back to Club" },
        contestEditorConfig: {
            clubsUrl: "/api/clubs/owned",
            getContestUrl: "/api/contests/editor/{id}",
            initialContestId: contest.id,
            lockedAccessType: "club",
            lockedClubId: club.id,
            saveUrl: "/api/contests/save",
        },
        head: `<script type="module" src="/admin/add-contest/add-contest.js" defer></script>`,
        mainSection: { unframed: true, width: "max-w-7xl" },
        title: `Edit ${contest.name}`,
    });
});

router.get("/clubs/:clubID", authenticateToken, async (req, res) => {
    if (!req.user) {
        res.status(403).render("contest-unavailable", {
            message: "Please log in to view clubs.",
            title: "Unauthorized",
        });
        return;
    }

    const clubID = validator.escape(req.params.clubID.trim());
    const club = await ClassClub.findOne({ id: clubID }).lean<IClassClub>();
    if (!club) {
        res.status(404).render("contest-unavailable", {
            message: "That club could not be found.",
            title: "Club Not Found",
        });
        return;
    }
    const role = await getClubRole(club, req.user.id);
    if (role !== "admin" && role !== "member" && role !== "owner") {
        res.status(403).render("contest-unavailable", {
            message: "You must be a member of this club to view it. Enter an invite code on the Clubs page to request access.",
            title: "Club Private",
        });
        return;
    }

    res.render("club-detail", {
        backArrow: { href: "/clubs", text: "Back to Clubs" },
        club,
        head: `<script type="module" src="/clubs/club-detail.js" defer></script>`,
        mainSection: { unframed: true, width: "max-w-7xl" },
        title: club.name,
    });
});
