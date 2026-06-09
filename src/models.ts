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

import { IClassClub, IContest, IContestAttempt, IPasswordReset, IProblem, IProblemTestcase, IResult, ISubmission, IUser } from "./types/models";

const ResultSchema = new mongoose.Schema<IResult>(
    {
        mem: { required: true, type: String },
        status: { required: true, type: String },
        time: { required: true, type: String },
    },
    { _id: false },
);

const UserSchema = new mongoose.Schema<IUser>({
    admin: { default: false, type: Boolean },
    email: { required: true, type: String, unique: true },
    password: { required: true, type: String },
    verificationToken: String,
    verificationTokenExpiresAt: Date,
    verified: { default: false, type: Boolean },
});

UserSchema.index(
    { verificationTokenExpiresAt: 1 },
    {
        expireAfterSeconds: 0,
        partialFilterExpression: { verified: false },
    },
);

/**
 * User model
 */
export const User = mongoose.model<IUser>("User", UserSchema);

const PasswordResetSchema = new mongoose.Schema<IPasswordReset>({
    expiresAt: { required: true, type: Date },
    tokenHash: { required: true, type: String, unique: true },
    userId: { ref: "User", required: true, type: mongoose.Schema.Types.ObjectId },
});

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ userId: 1 });

/**
 * Password reset model
 */
export const PasswordReset = mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema);

const ProblemSchema = new mongoose.Schema<IProblem>(
    {
        contestID: { default: null, type: String }, // null if not a contest problem
        id: { required: true, type: String }, // in case we want to do stuff like 5B like codeforces. CANNOT HAVE COLONS
        inputFormat: { required: true, type: String },
        isPrivate: Boolean,
        name: { required: true, type: String },
        numSampleTestcases: { required: true, type: Number },
        outputFormat: { required: true, type: String },
        problemStatement: { required: true, type: String },
        whitelist: [{ ref: "User", type: mongoose.Schema.Types.ObjectId }],
    },
    { strict: false },
);

ProblemSchema.index({ contestID: 1, id: 1 }, { unique: true });

/**
 * Problem model
 */
export const Problem = mongoose.model<IProblem>("Problem", ProblemSchema);

const ProblemTestcaseSchema = new mongoose.Schema<IProblemTestcase>({
    contestId: { default: null, index: true, type: String },
    input: { required: true, type: String },
    isSample: { default: false, required: true, type: Boolean },
    order: { required: true, type: Number },
    output: { required: true, type: String },
    problemId: { index: true, required: true, type: String },
});

ProblemTestcaseSchema.index({ contestId: 1, order: 1, problemId: 1 }, { unique: true });
ProblemTestcaseSchema.index({ contestId: 1, isSample: 1, problemId: 1 });

/**
 * Judge-only testcase model
 */
export const ProblemTestcase = mongoose.model<IProblemTestcase>("ProblemTestcase", ProblemTestcaseSchema);

const ClassClubSchema = new mongoose.Schema<IClassClub>(
    {
        id: { required: true, type: String, unique: true },
        inviteEmails: { default: [], required: true, type: [String] },
        joinPolicy: { default: "invite", enum: ["invite", "open"], required: true, type: String },
        memberEmails: { default: [], required: true, type: [String] },
        name: { required: true, type: String },
        ownerId: { ref: "User", type: mongoose.Schema.Types.ObjectId },
        requestEmails: { default: [], required: true, type: [String] },
    },
    { timestamps: true },
);

ClassClubSchema.index({ inviteEmails: 1 });
ClassClubSchema.index({ ownerId: 1 });
ClassClubSchema.index({ memberEmails: 1 });
ClassClubSchema.index({ requestEmails: 1 });

/**
 * Class/club model for contest rosters.
 */
export const ClassClub = mongoose.model<IClassClub>("ClassClub", ClassClubSchema);

/**
 * Contest model
 */
const ContestSchema = new mongoose.Schema<IContest>(
    {
        accessType: { default: "public", enum: ["club", "public"], required: true, type: String },
        clubId: { default: null, type: String },
        createdBy: { ref: "User", type: mongoose.Schema.Types.ObjectId },
        durationMinutes: Number,
        endTime: { required: true, type: Date },
        id: { required: true, type: String },
        name: { required: true, type: String },
        problemIds: { default: [], required: true, type: [String] },
        problemPoints: { default: {}, of: Number, type: Map },
        startTime: { required: true, type: Date },
        timingMode: { default: "global", enum: ["global", "personal"], required: true, type: String },
    },
    { strict: false },
);

ContestSchema.index({ clubId: 1, id: 1 }, { unique: true });

export const Contest = mongoose.model<IContest>("Contest", ContestSchema);

const ContestAttemptSchema = new mongoose.Schema<IContestAttempt>({
    contestId: { index: true, required: true, type: String },
    endsAt: { required: true, type: Date },
    startedAt: { required: true, type: Date },
    userId: { index: true, ref: "User", required: true, type: mongoose.Schema.Types.ObjectId },
});

ContestAttemptSchema.index({ contestId: 1, userId: 1 }, { unique: true });

/**
 * Personal contest timer model
 */
export const ContestAttempt = mongoose.model<IContestAttempt>("ContestAttempt", ContestAttemptSchema);

const SubmissionSchema = new mongoose.Schema<ISubmission>(
    {
        code: { required: true, type: String },
        completedAt: Date,
        contestId: { default: null, type: String },
        contestScored: { default: false, type: Boolean },
        error: String,
        legacyKey: { index: true, sparse: true, type: String, unique: true },
        problemId: { index: true, required: true, type: String },
        results: { default: [], of: ResultSchema, type: [ResultSchema] },
        status: { default: "queued", enum: ["completed", "failed", "queued", "running"], index: true, required: true, type: String },
        userId: { index: true, ref: "User", required: true, type: mongoose.Schema.Types.ObjectId },
    },
    { timestamps: true },
);

SubmissionSchema.index({ contestId: 1, createdAt: -1, problemId: 1, userId: 1 });

/**
 * Submission model
 */
export const Submission = mongoose.model<ISubmission>("Submission", SubmissionSchema);
