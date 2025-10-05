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

import { User } from "../models.js";

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
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) {
        res.render("verify", { success: false });
        return;
    }

    user.verified = true;
    user.verificationToken = undefined;
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

// TODO fix this system lol
router.get("/reset/:token", async (req, res) => {
    const user = await User.findOne({ resetToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    if (!user.possibleNewPassword) return res.status(400).json({ error: "Invalid new password" });

    user.password = user.possibleNewPassword;
    user.resetToken = undefined;
    user.possibleNewPassword = undefined;
    await user.save();

    // res.json({ message: `Email verified! You can now log in. Login: ${process.env.BASE_URL}/login` });
    // TODO: replace in views
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-100">
            <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                <h1 class="text-4xl font-bold text-center mb-6 text-green-400">Password Reset!</h1>
                <p class="text-center text-2xl mb-6">Password successfully reset. Contact us at codejointcrew@gmail.com for any inquiries.</p>
                <div class="text-center">
                    <a href="/login/" class="text-blue-400 hover:underline">← Login</a>
                </div>
            </div>
        </body>
        </html>
    `);
});
