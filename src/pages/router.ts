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
import { rateLimit } from "express-rate-limit";

import adminRouter from "./admin";
import contestsRouter from "./contests";
import homeRouter from "./home";
import problemsRouter from "./problems";
import userRouter from "./user";

/**
 * Pages router
 */
const router = express.Router();
export default router;

const pageLimiter = rateLimit({
    legacyHeaders: false,
    limit: 5000,
    message: { error: "Too many page requests! Rate limit exceeded." },
    standardHeaders: "draft-8",
    windowMs: 15 * 60 * 1000,
});

router.use(pageLimiter);

router.use("/", adminRouter);
router.use("/", contestsRouter);
router.use("/", homeRouter);
router.use("/", problemsRouter);
router.use("/", userRouter);
