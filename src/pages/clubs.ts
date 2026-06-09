import express from "express";
import validator from "validator";

import { authenticateToken } from "../middleware/authenticate";
import { ClassClub } from "../models";
import { canManageClub } from "../services/clubs";
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
