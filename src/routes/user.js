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

const express = require('express');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const transporter = require("../transporter.js");
const { User } = require('../models.js');
const authenticateToken = require('../authenticate.js')
const router = express.Router();

module.exports = router;

router.get("/verify/:token", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ error: "Invalid token" });

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    // res.json({ message: `Email verified! You can now log in. Login: ${process.env.BASE_URL}/login` });
    // TODO: add to views folder
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contest Not Started</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-100">
            <div class="max-w-4xl mx-auto mt-10 p-6 bg-gray-800 shadow-lg rounded-xl">
                <h1 class="text-4xl font-bold text-center mb-6 text-green-400">Email Verified!</h1>
                <p class="text-center text-2xl mb-6">Welcome to the community. Contact us at codejointcrew@gmail.com for any inquiries.</p>
                <div class="text-center">
                    <a href="/login/" class="text-blue-400 hover:underline">← Login</a>
                </div>
            </div>
        </body>
        </html>
    `);
});


router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).slice(2);

    const user = new User({ email, password: hashedPassword, verificationToken: token });
    await user.save();

    const link = `${process.env.BASE_URL}/verify/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `${name}: Verify Your Email`,
        text: `Click here to verify: ${link}\n(Link expires in one minute)`
    });

    res.json({ message: "Check your email to verify your account!" });

    // delete unverified accounts after a minute
    setTimeout(async () => {
        console.log("checking for unverified account");
        const updatedUser = await User.findOne({ email });
        if (!updatedUser.verified) {
            await User.deleteOne({ email });
            console.log("Deleted unverified account");
        }
    }, 1000*60);
});

// TODO: refresh tokens or something
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt:", email); // Debugging

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

    if (!user.verified) return res.status(400).json({ error: "Please verify your email first" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "48h" });
    res.json({ success: true, token });
});

router.post("/resetPassword", async (req, res) => {
    const { email, password } = req.body;

    // Check if the email already exists in the database
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ error: "Email is not registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = Math.random().toString(36).slice(2);
    user.resetToken = token;
    user.possibleNewPassword = hashedPassword;
    user.markModified("resetToken");
    user.markModified("possibleNewPassword");
    await user.save();

    const link = `${process.env.BASE_URL}/reset/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Reset your password`,
        text: `If you did NOT request this email, do NOT click the link and instead IGNORE this email so you don't give access to your account to an unknown third-party.\n\nClick here to confirm reset: ${link}\n(Link expires in one minute)`
    });

    res.json({ message: "Check your email to confirm resetting your password!" });

    // delete reset tokens after one minute
    setTimeout(async () => {
        const updatedUser = await User.findOne({ email });
        updatedUser.resetToken = null;
        updatedUser.possibleNewPassword = null;
        updatedUser.markModified("resetToken");
        updatedUser.markModified("possibleNewPassword");
        await updatedUser.save();
    }, 1000*60);
});

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
            <title>Contest Not Started</title>
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

router.post("/getCode", authenticateToken, async (req, res) => {
    const { problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting code:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    const result = user.code[combinedID];
    res.json({ result });
});

// get results from a problem
router.post("/getResult", authenticateToken, async (req, res) => {
    const { problemID, contestID } = req.body;
    const user = await User.findById(req.user.id);
    // console.log("User requesting result:", user);
    if (!user) {
        console.error("WTF NO USER FOUND");
    }
    let combinedID = problemID;
    if (contestID) {
        combinedID = contestID.concat(":", problemID);
    }
    const result = user.results[combinedID]
    res.json({ result });
});
