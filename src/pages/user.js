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

/**
 * User routing
 * @module pages/user
 */

const express = require("express");

const { User } = require("../models.js");

/**
 * User pages router
 * @memberof module:pages/user
 */
const router = express.Router();
module.exports = router;

router.get("/register", (req, res) => {
    res.render("register", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/register/register.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Register",
    });
});
/**
 * Verifies a user
 * @name GET/verify/:token
 * @function
 * @memberof module:pages/user
 * @param {string} req.params.token Verification token
 * @returns Html that confirms user has been verified
 */
router.get("/verify/:token", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.render("verify", { success: false });

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    res.render("verify", { success: true });
});

/**
 * Login page
 * @name GET/login
 * @function
 * @memberof module:pages/user
 * @returns html page
 */
router.get("/login", (req, res) => {
    res.render("login", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/login/login.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Login",
    });
});
/**
 * Sends html page for /forgot-password
 * @name GET/forgot-password
 * @function
 * @memberof module:pages/user
 * @returns Html page
 */
router.get("/forgot-password", (req, res) => {
    res.render("forgot-password", {
        backArrow: { href: "/", text: "Back to home" },
        head: `<script type="module" src="/forgot-password/forgot-password.js" defer=""></script>`,
        mainSection: { width: "max-w-md" },
        title: "Reset Password",
    });
});
/**
 * Resets the user's password. TODO: fix this system lmao
 * @name GET/reset/:token
 * @function
 * @memberof module:pages/user
 * @param {string} req.params.token  User's reset token
 * @returns Html confirming password has been reset
 */
router.get("/reset/:token", async (req, res) => {
    const user = await User.findOne({ resetToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    user.password = user.possibleNewPassword;
    user.resetToken = null;
    user.possibleNewPassword = null;
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
