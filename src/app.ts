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

import "express-async-errors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import expressLayouts from "express-ejs-layouts";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";

import apiRouter from "./api/router";
import pageRouter from "./pages/router";

export function createApp(): express.Express {
    const app = express();
    const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
    app.set("trust proxy", trustProxy);

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.use(expressLayouts);

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    baseUri: ["'self'"],
                    connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
                    defaultSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
                    formAction: ["'self'"],
                    frameSrc: ["'none'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    mediaSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com", "https://ajaxorg.github.io/"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
                },
            },
            crossOriginEmbedderPolicy: false,
            hsts: {
                includeSubDomains: true,
                maxAge: 31536000,
                preload: true,
            },
            noSniff: true,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            xssFilter: true,
        }),
    );

    const generalLimiter = rateLimit({
        legacyHeaders: false,
        limit: 1000,
        message: { error: "Too many requests from this IP, please try again later." },
        standardHeaders: "draft-8",
        windowMs: 15 * 60 * 1000,
    });

    app.use(generalLimiter);

    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
    app.use(
        cors({
            credentials: true,
            origin: [baseUrl],
        }),
    );

    app.use(bodyParser.json({ limit: "10mb" }));
    app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, "..", "public")));

    app.use(pageRouter);
    app.use(apiRouter);

    app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
        console.error("Unhandled request error:", err);
        if (res.headersSent) {
            next(err);
            return;
        }
        res.status(500).json({ error: "Internal server error" });
    });

    return app;
}

export function parseTrustProxy(value: string | undefined): boolean | number {
    if (value === undefined) return true;
    if (value === "true") return true;
    if (value === "false") return false;
    const n = Number(value);
    if (!isNaN(n) && n >= 0) return n;
    return true;
}
