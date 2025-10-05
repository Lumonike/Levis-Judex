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

import { Problem } from "../models";

/**
 * Problem Router
 */
const router = express.Router();
export default router;

/**
 * @swagger
 * TODO
 */
router.get("/get-problem", async (req, res) => {
    const id = req.query.id;

    if (!id) {
        return res.status(400).json({ message: "Problem ID is required" });
    }

    if (typeof id !== "string") {
        return res.status(400).json({ message: "Problem ID must be a string" });
    }

    const sanitizedId = validator.escape(id.trim());

    try {
        const problem = await Problem.findOne({ id: sanitizedId });
        if (problem == null) {
            return res.status(404).json({ message: "Problem not found" });
        }
        res.json(problem);
    } catch (error) {
        console.error("Error fetching problem:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
