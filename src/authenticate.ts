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
import jwt, { JwtPayload } from "jsonwebtoken";

export default function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const token: unknown = req.cookies.authToken;
    if (typeof token !== "string") {
        res.status(403).json({ error: "Invalid token" });
        return;
    }
    if (!token) {
        res.status(403).json({ error: "Access denied. No token provided." });
        return;
    }
    if (typeof process.env.JWT_SECRET === "string") {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
            req.user = user;
            next();
        } catch {
            res.status(403).json({ error: "Invalid or expired token." });
            return;
        }
    } else {
        res.status(500).json({ error: "Internal server error." });
        console.error("JWT_SECRET not defined!");
        return;
    }
}
