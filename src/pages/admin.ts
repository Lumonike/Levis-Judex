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

import { authenticateToken } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/authorize.js";

/**
 * Router for admin pages
 */
const router = express.Router();
export default router;

router.get("/admin", authenticateToken, requireAdmin, (req, res) => {
    res.render("admin/admin", {
        backArrow: { href: "/", text: "Back to Home" },
        mainSection: { centered: true },
        title: "Admin",
    });
});

router.get("/admin/add-admin", authenticateToken, requireAdmin, (req, res) => {
    res.render("admin/add-admin", {
        backArrow: { href: "/admin", text: "Back to Admin" },
        head: `<script src="/admin/add-admin/add-admin.js" defer></script>`,
        mainSection: { centered: true },
        title: "Add Admin",
    });
});

router.get("/admin/add-problem", authenticateToken, requireAdmin, (req, res) => {
    res.render("admin/add-problem", {
        backArrow: { href: "/admin", text: "Back to Admin" },
        head: `<script src="/admin/add-problem/add-problem.js" defer></script>`,
        mainSection: { centered: true },
        title: "Add Problem",
    });
});

router.get("/admin/add-contest", authenticateToken, requireAdmin, (req, res) => {
    const initialContestId = typeof req.query.contest === "string" ? validator.escape(req.query.contest.trim()) : "";
    res.render("admin/add-contest", {
        backArrow: { href: "/admin", text: "Back to Admin" },
        contestEditorConfig: {
            clubsUrl: "/api/admin/list-clubs",
            getContestUrl: "/api/admin/get-contest?id={id}",
            ...(initialContestId ? { initialContestId } : {}),
            saveUrl: "/api/admin/save-contest",
        },
        head: `<script type="module" src="/admin/add-contest/add-contest.js" defer></script>`,
        mainSection: { unframed: true, width: "max-w-7xl" },
        title: "Add Contest",
    });
});

router.get("/admin/clubs", authenticateToken, requireAdmin, (req, res) => {
    res.redirect("/clubs");
});
