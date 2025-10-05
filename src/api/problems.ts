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
import { Types } from "mongoose";

import { problemMiddleware } from "../middleware/problem";
import { User } from "../models";
import { IProblem } from "../types/models";

/**
 * Problem Router
 */
const router = express.Router();
export default router;

/**
 * @swagger
 * TODO
 */
router.get(
    "/get-problem",
    problemMiddleware((req) => req.query.id as string),
    async (req, res) => {
        if (!req.problem) {
            return res.status(404).json({ error: "Couldn't get problem" });
        }

        const problem: Omit<IProblem, "whitelist"> & { whitelist?: (string | Types.ObjectId)[] } = req.problem;
        problem.whitelist ??= [] as string[];

        if (!req.user) {
            problem.whitelist = [] as string[];
        } else {
            const isAdmin = (await User.findById(req.user.id).select("admin"))?.admin ?? false;
            if (!isAdmin) {
                problem.whitelist = [] as string[];
            } else {
                for (let i = problem.whitelist.length - 1; i >= 0; i--) {
                    const userEmail = (await User.findById(problem.whitelist[i]).select("email"))?.email;
                    if (!userEmail) {
                        problem.whitelist.splice(i, 1);
                        continue;
                    }
                    problem.whitelist[i] = userEmail;
                }
            }
        }
        return res.json(problem);
    },
);
