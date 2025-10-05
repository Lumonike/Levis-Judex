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

import { NextFunction, Request, Response } from "express";

import { Problem, User } from "../models";
import { IProblem } from "../types/models";
import authenticateToken from "./authenticate";

export function problemMiddleware(getProblemId: (req: Request) => string | undefined, action?: "redirect") {
    return async (req: Request, res: Response, next: NextFunction) => {
        const problem: IProblem | null = await Problem.findOne({ id: getProblemId(req) }).lean();

        if (!problem) {
            if (action == "redirect") {
                res.redirect("/problems");
                return;
            }
            return res.status(404).json({ error: "Not found" });
        }

        req.problem = problem;

        if (!problem.isPrivate) {
            next();
            return;
        }

        if (!problem.whitelist) {
            console.error(`Problem ${problem.id} is private but doesn't have a whitelist!`);
            if (action == "redirect") {
                res.redirect("/problems");
                return;
            }
            return res.status(500).json({ error: "Internal server error" });
        }

        authenticateToken(req, res, (err?) => {
            void (async (err?) => {
                if (err) {
                    if (action == "redirect") {
                        res.redirect("/problems");
                        return;
                    }
                    res.status(403).json({ error: "Unauthorized" });
                    return;
                }
                const user = await User.findById(req.user?.id);
                if (!user) {
                    if (action == "redirect") {
                        res.redirect("/problems");
                        return;
                    }
                    res.status(403).json({ error: "Unauthorized" });
                    return;
                }
                if (user.admin || problem.whitelist?.includes(user._id)) {
                    next();
                    return;
                }
                if (action == "redirect") {
                    res.redirect("/problems");
                    return;
                }
                res.status(403).json({ error: "Unauthorized" });
            })(err);
        });
    };
}

export function submitMiddleware(getProblemId: (req: Request) => string | undefined) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const problem: IProblem | null = await Problem.findOne({ id: getProblemId(req) });

        if (!problem) {
            return res.status(404).json({ error: "Not found" });
        }

        req.problem = problem;

        if (!problem.isPrivate) {
            next();
            return;
        }

        if (!problem.whitelist) {
            console.error(`Problem ${problem.id} is private but doesn't have a whitelist!`);
            return res.status(500).json({ error: "Internal server error" });
        }

        const user = await User.findById(req.user?.id);
        if (!user) {
            res.status(403).json({ error: "Unauthorized" });
            return;
        }
        if (user.admin || problem.whitelist.includes(user._id)) {
            next();
            return;
        }
        res.status(403).json({ error: "Unauthorized" });
    };
}
