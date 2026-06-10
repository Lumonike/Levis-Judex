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

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const token: unknown = req.cookies.authToken;
    if (typeof token !== "string") {
        rejectUnauthenticated(req, res);
        return;
    }
    if (!token) {
        rejectUnauthenticated(req, res);
        return;
    }
    if (typeof process.env.JWT_SECRET === "string") {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
            req.user = user;
            next();
        } catch {
            rejectUnauthenticated(req, res);
            return;
        }
    } else {
        res.status(500).json({ error: "Internal server error." });
        console.error("JWT_SECRET not defined!");
        return;
    }
}

/**
 * authenticate token if possible, but not required
 * @param req
 * @param res
 * @param next
 */
export function authenticateTokenOptional(req: Request, res: Response, next: NextFunction): void {
    const token: unknown = req.cookies.authToken;
    if (typeof token !== "string") {
        next();
        return;
    }
    if (!token) {
        next();
        return;
    }
    if (typeof process.env.JWT_SECRET === "string") {
        try {
            const user = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
            req.user = user;
            next();
        } catch {
            next();
        }
    } else {
        next();
    }
}

function expectsJson(req: Request): boolean {
    const acceptHeader = req.headers.accept ?? "";
    return (
        req.path.startsWith("/api/") ||
        req.originalUrl.startsWith("/api/") ||
        req.headers["x-requested-with"] === "XMLHttpRequest" ||
        acceptHeader.includes("application/json") ||
        !acceptHeader.includes("text/html")
    );
}

function rejectUnauthenticated(req: Request, res: Response): void {
    if (expectsJson(req)) {
        res.status(403).json({ error: "Please log in again." });
        return;
    }

    res.clearCookie("authToken");
    res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || req.url || "/")}`);
}
