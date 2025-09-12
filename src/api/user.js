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
 * @module api/user
 */

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const disposableDomains = require("disposable-email-domains");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const validator = require("validator");

const authenticateToken = require("../authenticate.js");
const judge = require("../judge.js");
const { User } = require("../models.js");
const transporter = require("../transporter.js");

/**
 * User api router
 * @memberof module:pages/user
 */
const router = express.Router();
module.exports = router;

const registerLimiter = rateLimit({
    legacyHeaders: false,
    limit: 3,
    message: { error: "Too many registrations from this IP. Rate limit exceeded" },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

/**
 * Registers user
 * @name POST/api/user/register
 * @function
 * @memberof module:api/user
 * @param {string} req.body.name Name of user (only used for email)
 * @param {string} req.body.email Email of user
 * @param {string} req.body.password Password of user
 * @returns {Object} Use key "message" to get message, either gives an error or asks users to verify
 */
router.post("/register", registerLimiter, async (req, res) => {
    const { email, name, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid input types." });
    }

    const sanitizedName = validator.escape(name.trim());
    const sanitizedEmail = validator.normalizeEmail(email.trim());

    if (!sanitizedEmail) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    if (!validator.isEmail(sanitizedEmail)) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    const emailDomain = sanitizedEmail.split("@")[1].toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
        return res.status(400).json({ error: "Disposable email address." });
    }

    if (password.length > 128) {
        return res.status(400).json({ error: "Password must be less than 128 characters." });
    }

    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
        return res.status(400).json({ error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(8).toString("base64url");

    const user = new User({ email: sanitizedEmail, password: hashedPassword, verificationToken: token });
    await user.save();

    const link = `${process.env.BASE_URL}/verify/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        subject: `${sanitizedName}: Verify Your Email`,
        text: `Click here to verify: ${link}\n(Link expires in one minute)`,
        to: sanitizedEmail,
    });

    res.json({ message: "Check your email to verify your account!" });

    // delete unverified accounts after a minute
    setTimeout(async () => {
        console.log("checking for unverified account");
        const updatedUser = await User.findOne({ email: sanitizedEmail });
        if (updatedUser && !updatedUser.verified) {
            await User.deleteOne({ email: sanitizedEmail });
            console.log("Deleted unverified account");
        }
    }, 1000 * 60);
});

const loginLimiter = rateLimit({
    legacyHeaders: false,
    limit: 10,
    message: { error: "Too many login requests! Rate limit exceeded" },
    standardHeaders: "draft-8",
    windowMs: 15 * 60 * 1000,
});

/**
 * Logs in user. TODO: refresh tokens or something, also make return less of a mess
 * @name POST/api/user/login
 * @function
 * @memberof module:api/user
 * @param {string} req.body.email User's email
 * @param {string} req.body.password User's password
 * @returns {Object.<string, *>} Either an error message (accessed through key "error") or an object with keys "success" (bool) and "token" (string)
 */
router.post("/login", loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid input types." });
    }

    const sanitizedEmail = validator.normalizeEmail(email.trim());
    if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    console.log("Login attempt:", sanitizedEmail);

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

    if (!user.verified) return res.status(400).json({ error: "Please verify your email first" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "48h" });
    res.json({ success: true, token });
});

const resetPasswordLimiter = rateLimit({
    legacyHeaders: false,
    limit: 10,
    message: { error: "Too many password reset attempts! Rate limit exceeded." },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

/**
 * Prepares to reset user's password. TODO: This system absolutely sucks
 * @name POST/api/user/reset-password
 * @function
 * @memberof module:api/user
 * @param {string} req.body.email User's email
 * @param {string} req.body.password New password that the user wants
 */
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Invalid input types." });
    }

    const sanitizedEmail = validator.normalizeEmail(email.trim());
    if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
        return res.status(400).json({ error: "Invalid email address." });
    }

    if (password.length > 128) {
        return res.status(400).json({ error: "Password must be less than 128 characters." });
    }

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
        return res.status(400).json({ error: "Email is not registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(8).toString("base64url");
    user.resetToken = token;
    user.possibleNewPassword = hashedPassword;
    user.markModified("resetToken");
    user.markModified("possibleNewPassword");
    await user.save();

    const link = `${process.env.BASE_URL}/reset/${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        subject: `Reset your password`,
        text: `If you did NOT request this email, do NOT click the link and instead IGNORE this email so you don't give access to your account to an unknown third-party.\n\nClick here to confirm reset: ${link}\n(Link expires in one minute)`,
        to: sanitizedEmail,
    });

    res.json({ message: "Check your email to confirm resetting your password!" });

    // delete reset tokens after one minute
    setTimeout(async () => {
        const updatedUser = await User.findOne({ email: sanitizedEmail });
        if (updatedUser) {
            updatedUser.resetToken = null;
            updatedUser.possibleNewPassword = null;
            updatedUser.markModified("resetToken");
            updatedUser.markModified("possibleNewPassword");
            await updatedUser.save();
        }
    }, 1000 * 60);
});

/**
 * Gets the code the user has submitted for a problem
 * @name POST/api/user/get-code
 * @function
 * @memberof module:api/user
 * @param {string} req.body.problemID Problem the code was from
 * @param {string | null} req.body.contestID Contest the problem was from, null if not part of contest
 * @returns {Object.<string, string>} The code written, accessed through key "result"
 */
router.post("/get-code", authenticateToken, async (req, res) => {
    const { contestID, problemID } = req.body;

    if (!problemID) {
        return res.status(400).json({ error: "Problem ID is required." });
    }

    if (typeof problemID !== "string") {
        return res.status(400).json({ error: "Invalid problem ID type." });
    }

    if (contestID && typeof contestID !== "string") {
        return res.status(400).json({ error: "Invalid contest ID type." });
    }

    const sanitizedProblemID = validator.escape(problemID.trim());
    const sanitizedContestID = contestID ? validator.escape(contestID.trim()) : null;

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    let combinedID = sanitizedProblemID;
    if (sanitizedContestID) {
        combinedID = sanitizedContestID.concat(":", sanitizedProblemID);
    }
    const result = user.code[combinedID];
    res.json({ result });
});

/**
 * Gets the results of the code the user has submitted
 * @name POST/api/user/get-result
 * @function
 * @memberof module:api/user
 * @param {string} req.body.problemID Problem the code was from
 * @param {string | null} req.body.contestID Contest the problem was from, null if not part of contest
 * @returns {Object.<string, judge.Result[]>} The results, accessed through key "result"
 */
router.post("/get-result", authenticateToken, async (req, res) => {
    const { contestID, problemID } = req.body;

    if (!problemID) {
        return res.status(400).json({ error: "Problem ID is required." });
    }

    if (typeof problemID !== "string") {
        return res.status(400).json({ error: "Invalid problem ID type." });
    }

    if (contestID && typeof contestID !== "string") {
        return res.status(400).json({ error: "Invalid contest ID type." });
    }

    const sanitizedProblemID = validator.escape(problemID.trim());
    const sanitizedContestID = contestID ? validator.escape(contestID.trim()) : null;

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    let combinedID = sanitizedProblemID;
    if (sanitizedContestID) {
        combinedID = sanitizedContestID.concat(":", sanitizedProblemID);
    }
    const result = user.results[combinedID];
    res.json({ result });
});

/**
 * Checks if a token is valid
 * @name POST/api/user/valid-token
 * @function
 * @memberof module:api/user
 * @returns status code
 */
router.post("/valid-token", authenticateToken, async (req, res) => {
    return res.status(200).json({ success: "Token is valid" });
});
