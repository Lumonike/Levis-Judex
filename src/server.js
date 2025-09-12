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

/** Main module
 * @module server
 */

require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");
const path = require("path");

/**
 * App
 * @memberof module:server
 */
const app = express();

function parseTrustProxy(value) {
    if (value === undefined) return true;
    if (value === "true") return true;
    if (value === "false") return false;
    const n = Number(value);
    if (!isNaN(n) && n >= 0) return n;
    return true;
}

const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
app.set("trust proxy", trustProxy);

// used to test trust proxy
// app.get('/ip', (request, response) => response.send(request.ip));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(expressLayouts);

// Add security helpers to EJS
app.locals.escapeHtml = (text) => {
    if (typeof text !== "string") return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
};

app.locals.safeJson = (obj) => {
    return JSON.stringify(obj).replace(/</g, "\\u003c");
};

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                baseUri: ["'self'"],
                connectSrc: ["'self'"],
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

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const allowedOrigins = [baseUrl];

app.use(
    cors({
        credentials: true,
        origin: allowedOrigins,
    }),
);

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/", (req, res, next) => {
    if (req.url.endsWith(".html")) {
        return res.redirect(req.url.slice(0, -"index.html".length));
    }
    next();
});

app.use("/", require("./pages"));
app.use("/api", require("./api"));

app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
