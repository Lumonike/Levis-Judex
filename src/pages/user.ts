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

import { hashToken } from "../lib/tokens.js";
import { PasswordReset, User } from "../models.js";

/**
 * User pages router
 */
const router = express.Router();
export default router;

router.get("/register", (req, res) => {
    res.render("register", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/register/register.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Register",
    });
});

router.get("/verify/:token", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token, verificationTokenExpiresAt: { $gt: new Date() } });
    if (!user) {
        res.render("verify", { success: false });
        return;
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    res.render("verify", { success: true });
});

router.get("/login", (req, res) => {
    res.render("login", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/login/login.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Login",
    });
});

router.get("/forgot-password", (req, res) => {
    res.render("forgot-password", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/forgot-password/forgot-password.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Reset Password",
    });
});

router.get("/reset/:token", async (req, res) => {
    const reset = await PasswordReset.findOne({ expiresAt: { $gt: new Date() }, tokenHash: hashToken(req.params.token) });
    res.render("reset-password", {
        backArrow: { href: "/login", text: "Back to login" },
        head: `<script type="module" src="/forgot-password/forgot-password.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Set New Password",
        token: req.params.token,
        valid: Boolean(reset),
    });
});
