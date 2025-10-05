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

import bcrypt from "bcryptjs";
import crypto from "crypto";
import disposableDomains from "disposable-email-domains";
import express, { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import validator from "validator";

import authenticateToken from "../authenticate";
import { User } from "../models";
import { transporter } from "../transporter";
import { ApiError, ApiMessage, ApiSuccess } from "../types/api";
import { IResult } from "../types/models";

/**
 * User api router
 */
const router = express.Router();
export default router;

const registerLimiter = rateLimit({
    legacyHeaders: false,
    limit: 3,
    message: { error: "Too many registrations from this IP. Rate limit exceeded" },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

/**
 * @swagger
 * TODO
 */
router.post(
    "/register",
    registerLimiter,
    async (req: Request<unknown, ApiError | ApiMessage, { email: string; name: string; password: string }>, res: Response) => {
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

        const baseUrl: string = process.env.BASE_URL ?? "http://localhost:3000";

        const link = `${baseUrl}/verify/${token}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            subject: `${sanitizedName}: Verify Your Email`,
            text: `Click here to verify: ${link}\n(Link expires in one minute)`,
            to: sanitizedEmail,
        });

        res.json({ message: "Check your email to verify your account!" });

        // delete unverified accounts after a minute
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
        await User.findOne({ email: sanitizedEmail }).then(async (updatedUser) => {
            if (updatedUser && !updatedUser.verified) {
                console.log("Deleted unverified account");
                await User.deleteOne({ email: sanitizedEmail });
            }
        });
    },
);

const loginLimiter = rateLimit({
    legacyHeaders: false,
    limit: 10,
    message: { error: "Too many login requests! Rate limit exceeded" },
    standardHeaders: "draft-8",
    windowMs: 15 * 60 * 1000,
});

/**
 * @swagger
 * TODO
 */
router.post("/login", loginLimiter, async (req: Request<unknown, ApiError | ApiSuccess, { email: string; password: string }>, res: Response) => {
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

    if (typeof process.env.JWT_SECRET === "string") {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "48h" });
        res.cookie("authToken", token, {
            httpOnly: true,
            maxAge: 48 * 60 * 60 * 1000,
            sameSite: "strict",
            secure: true,
        });
        res.status(200).json({ success: "Successful login" });
        return;
    } else {
        res.status(500).json({ error: "Internal server error" });
        console.error("Failed to set JWT_SECRET");
    }
});

/**
 * @swagger
 * TODO
 */
router.post("/logout", (req, res) => {
    res.clearCookie("authToken");
    res.json({ message: "Logged out" });
});

const resetPasswordLimiter = rateLimit({
    legacyHeaders: false,
    limit: 10,
    message: { error: "Too many password reset attempts! Rate limit exceeded." },
    standardHeaders: "draft-8",
    windowMs: 60 * 60 * 1000,
});

/**
 * @swagger
 * TODO
 */
router.post(
    "/reset-password",
    resetPasswordLimiter,
    async (req: Request<unknown, ApiError | ApiSuccess, { email: string; password: string }>, res: Response) => {
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

        const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
        const link = `${baseUrl}/reset/${token}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            subject: `Reset your password`,
            text: `If you did NOT request this email, do NOT click the link and instead IGNORE this email so you don't give access to your account to an unknown third-party.\n\nClick here to confirm reset: ${link}\n(Link expires in one minute)`,
            to: sanitizedEmail,
        });

        res.json({ message: "Check your email to confirm resetting your password!" });

        // delete reset tokens after one minute
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60));
        await User.findOne({ email: sanitizedEmail })
            .then((updatedUser) => {
                if (updatedUser) {
                    updatedUser.resetToken = undefined;
                    updatedUser.possibleNewPassword = undefined;
                    updatedUser.markModified("resetToken");
                    updatedUser.markModified("possibleNewPassword");
                    return updatedUser.save();
                }
            })
            .then(() => {
                console.log("Deleted reset token");
            });
    },
);

/**
 * @swagger
 * TODO
 */
router.post(
    "/get-code",
    authenticateToken,
    async (req: Request<unknown, ApiError | { result: string }, { contestID: string; problemID: string }>, res: Response) => {
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

        const user = await User.findById(req.user?.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let combinedID = sanitizedProblemID;
        if (sanitizedContestID) {
            combinedID = sanitizedContestID.concat(":", sanitizedProblemID);
        }
        const result = user.code.get(combinedID) ?? "";
        res.json({ result });
    },
);

/**
 * @swagger
 * TODO
 */
router.post(
    "/get-result",
    authenticateToken,
    async (req: Request<unknown, ApiError | { result: IResult[] }, { contestID: string; problemID: string }>, res: Response) => {
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

        const user = await User.findById(req.user?.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let combinedID = sanitizedProblemID;
        if (sanitizedContestID) {
            combinedID = sanitizedContestID.concat(":", sanitizedProblemID);
        }
        const result = user.results.get(combinedID);
        res.json({ result });
    },
);

/**
 * @swagger
 * TODO
 */
router.get("/valid-token", authenticateToken, (req, res) => {
    return res.status(200).json({ success: "Token is valid" });
});
