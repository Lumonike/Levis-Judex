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
 * Web page rendering
 * @module pages
 */

const express = require('express');
const { rateLimit } = require('express-rate-limit');

/**
 * Pages router
 * @name router
 * @memberof module:pages
 */
const router = express.Router();
module.exports = router;

const pageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: "Too many page requests! Rate limit exceeded." },
});

router.use(pageLimiter);

router.use("/", require("./admin.js"));
router.use("/", require("./contests.js"));
router.use("/", require("./home.js"));
router.use("/", require("./problems.js"));
router.use("/", require("./user.js"));
