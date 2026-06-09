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

import express, { Request, Response } from "express";
import { Types } from "mongoose";
import validator from "validator";

import { sanitizeProblemHtml } from "../lib/sanitize";
import { authenticateToken } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/authorize";
import { ClassClub, Problem, User } from "../models";
import { ContestSaveBody, getEditableContest, isExpectedContestSaveError, parseContestSaveBody } from "../services/contest-editor";
import { saveContestWithProblems } from "../services/contests";
import { saveProblemWithTestcases } from "../services/problems";
import { ApiError, ApiMessage, ApiSuccess } from "../types/api";
import { IProblemWithTestcases } from "../types/models";

/**
 * Router for admin
 */
const router = express.Router();
export default router;

const maxTestcases = 50;

interface ClassClubSaveBody {
    id: string;
    memberEmails?: string | string[];
    name: string;
}

/**
 * @swagger
 * TODO
 */
router.post(
    "/set-admin-status",
    authenticateToken,
    requireAdmin,
    async (req: Request<unknown, ApiError | ApiSuccess, { email: string; status: boolean }>, res: Response) => {
        const { email, status } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({ error: "Valid email is required" });
        }

        if (typeof status !== "boolean") {
            return res.status(400).json({ error: "Status must be a boolean" });
        }

        const sanitizedEmail = validator.normalizeEmail(email.trim());
        if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
            return res.status(400).json({ error: "Invalid email address" });
        }

        console.log("attempting to change status of ", sanitizedEmail);
        const user = await User.findOne({ email: sanitizedEmail });
        if (!user) {
            return res.status(400).json({ error: "Failed to find user" });
        }
        user.admin = status;
        user.markModified("admin");
        await user.save();
        res.json({ success: true });
    },
);

router.get("/list-problems", authenticateToken, requireAdmin, async (req, res) => {
    const problems = await Problem.find({ $or: [{ contestID: null }, { contestID: { $exists: false } }] })
        .select("id name")
        .sort({ id: 1 })
        .lean();
    res.json({ problems });
});

router.get("/list-clubs", authenticateToken, requireAdmin, async (req, res) => {
    const clubs = await ClassClub.find().select("id memberEmails name ownerId").sort({ name: 1 }).lean();
    return res.json({ clubs });
});

router.post("/save-club", authenticateToken, requireAdmin, async (req: Request<unknown, ApiMessage, ClassClubSaveBody>, res: Response) => {
    try {
        const club = normalizeClassClub(req.body);
        await ClassClub.findOneAndUpdate(
            { id: club.id },
            {
                $set: {
                    memberEmails: club.memberEmails,
                    name: club.name,
                    ...(req.user?.id ? { ownerId: req.user.id } : {}),
                },
            },
            { new: true, setDefaultsOnInsert: true, upsert: true },
        );
        return res.json({ message: "Successfully saved class/club!" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save class/club";
        return res.status(400).json({ message });
    }
});

router.get("/get-contest", authenticateToken, requireAdmin, async (req, res) => {
    const id = req.query.id;
    const clubId = req.query.club;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Contest ID is required" });
    }
    if (clubId !== undefined && typeof clubId !== "string") {
        return res.status(400).json({ message: "Club ID must be a string" });
    }

    const contest = await getEditableContest(id, clubId ? validator.escape(clubId.trim()) : null);
    if (!contest) {
        return res.status(404).json({ message: "Contest not found" });
    }

    return res.json({ contest });
});

router.post("/save-contest", authenticateToken, requireAdmin, async (req: Request<unknown, ApiMessage, ContestSaveBody>, res: Response) => {
    try {
        await saveContestWithProblems(parseContestSaveBody(req.body, req.user?.id));
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

function normalizeClassClub(input: ClassClubSaveBody): { id: string; memberEmails: string[]; name: string } {
    if (!input.id || typeof input.id !== "string") {
        throw new Error("Class/club ID is required");
    }
    if (!input.name || typeof input.name !== "string") {
        throw new Error("Class/club name is required");
    }

    const rawEmails = Array.isArray(input.memberEmails)
        ? input.memberEmails
        : typeof input.memberEmails === "string"
          ? input.memberEmails.split(/[\n,]/)
          : [];
    const memberEmails = [
        ...new Set(
            rawEmails
                .map((email) => validator.normalizeEmail(email.trim()))
                .filter((email): email is string => typeof email === "string" && validator.isEmail(email)),
        ),
    ];

    return {
        id: validator.escape(input.id.trim()),
        memberEmails,
        name: validator.escape(input.name.trim()),
    };
}

/**
 * @swagger
 * TODO
 */
router.delete("/delete-problem", authenticateToken, requireAdmin, async (req, res) => {
    const id = req.query.id;

    if (!id) {
        return res.status(400).json({ message: "Problem ID is required" });
    }

    if (typeof id != "string") {
        return res.status(400).json({ message: "Problem ID must be a string" });
    }

    const sanitizedId = validator.escape(id.trim());

    try {
        const problem = await Problem.findOne({
            $or: [{ contestID: null }, { contestID: { $exists: false } }],
            id: sanitizedId,
        });
        if (problem == null) {
            return res.status(404).json({ message: "Problem not found" });
        }
        await problem.deleteOne();
        return res.status(200).json({ message: "Successfully deleted problem" });
    } catch (err: unknown) {
        res.status(500).json({ message: "Internal server error" });
        console.error("Failed to delete problem:", err);
        return;
    }
});

/**
 * @swagger
 * TODO
 */
router.post(
    "/save-problem",
    authenticateToken,
    requireAdmin,
    async (
        req: Request<unknown, ApiMessage, Omit<IProblemWithTestcases, "whitelist"> & { whitelist?: (string | Types.ObjectId)[] }>,
        res: Response,
    ) => {
        const update = { ...req.body };

        if (!update.id || typeof update.id !== "string") {
            return res.status(400).json({ message: "Problem ID is required and must be a string" });
        }

        if (!update.name || typeof update.name !== "string") {
            return res.status(400).json({ message: "Problem name is required and must be a string" });
        }

        if (update.name.length > 200) {
            return res.status(400).json({ message: "Problem name must be less than 200 characters" });
        }

        if (!update.problemStatement || typeof update.problemStatement !== "string") {
            return res.status(400).json({ message: "Problem statement is required and must be a string" });
        }

        if (!update.inputFormat || typeof update.inputFormat !== "string") {
            return res.status(400).json({ message: "Input format is required and must be a string" });
        }

        if (!update.outputFormat || typeof update.outputFormat !== "string") {
            return res.status(400).json({ message: "Output format is required and must be a string" });
        }

        if (typeof update.numSampleTestcases !== "number" || update.numSampleTestcases < 0) {
            return res.status(400).json({ message: "Number of sample testcases must be a non-negative number" });
        }

        if (!Array.isArray(update.inputTestcases) || !update.inputTestcases.every((tc) => typeof tc === "string")) {
            return res.status(400).json({ message: "Input testcases must be an array of strings" });
        }

        if (!Array.isArray(update.outputTestcases) || !update.outputTestcases.every((tc) => typeof tc === "string")) {
            return res.status(400).json({ message: "Output testcases must be an array of strings" });
        }

        if (update.inputTestcases.length === 0 || update.inputTestcases.length > maxTestcases) {
            return res.status(400).json({ message: `Problems must have between 1 and ${maxTestcases.toString()} testcases` });
        }

        if (update.inputTestcases.length !== update.outputTestcases.length) {
            return res.status(400).json({ message: "Input and output testcase counts must match" });
        }

        if (update.numSampleTestcases > update.inputTestcases.length) {
            return res.status(400).json({ message: "Sample testcase count cannot exceed total testcase count" });
        }

        if (update.contestID && typeof update.contestID !== "string") {
            return res.status(400).json({ message: "Contest ID must be a string" });
        }

        if (typeof update.isPrivate == "undefined" || !update.isPrivate) {
            update.isPrivate = false;
            update.whitelist = [];
        } else if (!Array.isArray(update.whitelist) || !update.whitelist.every((email) => typeof email === "string" && validator.isEmail(email))) {
            return res.status(400).json({ message: "Invalid whitelist" });
        }

        update.whitelist ??= [];

        for (let i = update.whitelist.length - 1; i >= 0; i--) {
            const email = update.whitelist[i];
            if (typeof email !== "string") {
                update.whitelist.splice(i, 1);
                continue;
            }
            const normalizedEmail = validator.normalizeEmail(email);
            const userId = (await User.findOne({ email: normalizedEmail }).select("_id"))?._id;
            if (userId) {
                update.whitelist[i] = userId;
            } else {
                update.whitelist.splice(i, 1);
            }
        }

        update.problemStatement = sanitizeProblemHtml(update.problemStatement);
        update.inputFormat = sanitizeProblemHtml(update.inputFormat);
        update.outputFormat = sanitizeProblemHtml(update.outputFormat);

        // console.log(update);

        try {
            const response = await saveProblemWithTestcases(update);
            console.log(`Saved problem ${response.id}`);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (response) {
                res.status(200).json({ message: "Successfully updated problem!" });
            } else {
                res.status(400).json({ message: "Failed to update problem!" });
            }
        } catch (error) {
            console.error("Error saving problem:", error);
            res.status(500).json({ message: "Internal server error while saving problem" });
        }
    },
);
