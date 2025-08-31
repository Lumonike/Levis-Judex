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
 * API
 * @module api
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { appendFile } = require('fs');

/**
 * API router
 * @name router
 * @memberof module:api
 */
const router = express.Router();
module.exports = router;

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: "Too many api requests! Rate limit exceeded." }
});

router.use(apiLimiter);

router.use("/admin", require("./admin.js"));
router.use("/problems", require("./problems.js"));
router.use("/submit", require("./submit.js"));
router.use("/user", require("./user.js"));
