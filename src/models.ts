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

import mongoose from "mongoose";

import { IContest, IProblem, IResult, IUser } from "./types/models";

const ResultSchema = new mongoose.Schema<IResult>(
    {
        mem: { required: true, type: String },
        status: { required: true, type: String },
        time: { required: true, type: String },
    },
    { _id: false },
);

/**
 * User model
 */
export const User = mongoose.model<IUser>(
    "User",
    new mongoose.Schema<IUser>({
        admin: { default: false, type: Boolean },
        code: { default: new Map(), of: String, required: true, type: Map },
        email: { required: true, type: String, unique: true },
        password: { required: true, type: String },
        possibleNewPassword: String,
        resetToken: String,
        results: {
            default: new Map(),
            of: [ResultSchema],
            type: Map,
        },
        verificationToken: String,
        verified: { default: false, type: Boolean },
    }),
);

/**
 * Problem model
 */
export const Problem = mongoose.model<IProblem>(
    "Problem",
    new mongoose.Schema<IProblem>({
        contestID: { default: null, type: String }, // null if not a contest problem
        id: { required: true, type: String }, // in case we want to do stuff like 5B like codeforces. CANNOT HAVE COLONS
        inputFormat: { required: true, type: String },
        inputTestcases: { required: true, type: [String] },
        name: { required: true, type: String },
        numSampleTestcases: { required: true, type: Number },
        outputFormat: { required: true, type: String },
        outputTestcases: { required: true, type: [String] },
        problemStatement: { required: true, type: String },
    }),
);

/**
 * Contest model
 */
export const Contest = mongoose.model<IContest>(
    "Contest",
    new mongoose.Schema<IContest>({
        endTime: { required: true, type: Date },
        id: { required: true, type: String },
        name: { required: true, type: String },
        problems: { required: true, type: [Problem.schema] },
        startTime: { required: true, type: Date },
    }),
);
