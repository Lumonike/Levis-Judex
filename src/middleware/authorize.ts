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

import { User } from "../models";

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
        res.status(403).json("Undefined user");
        return;
    }
    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(403).json("Undefined user");
        return;
    }
    if (user.admin) {
        next();
    } else {
        res.status(403).json("Invalid access");
    }
}
