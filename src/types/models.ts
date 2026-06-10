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

import { Types } from "mongoose";

/**
 * Class or club that can own restricted contests.
 */
export interface IClassClub {
    /** Stable public id used in URLs/forms */
    id: string;
    /** Shared code students can use to join */
    inviteCode?: string;
    /** Emails invited by the owner but not accepted yet */
    inviteEmails?: string[];
    /** Clubs are joined by invite code */
    joinPolicy?: "invite";
    /** Student emails that can access member-only contests */
    memberEmails: string[];
    /** Display name */
    name: string;
    /** Admin/teacher that created the club */
    ownerId?: Types.ObjectId;
    /** Emails that asked to join an invite-only club */
    requestEmails?: string[];
}

/**
 * Contest interface
 * @remarks used for mongoose stuff
 */
export interface IContest {
    /** Public contest or restricted to a class/club roster */
    accessType?: "club" | "public";
    /** Class/club id when accessType is club */
    clubId?: null | string;
    /** Admin/teacher that created the contest */
    createdBy?: Types.ObjectId;
    /** Personal contest length in minutes */
    durationMinutes?: number;
    /** When the contest ends */
    endTime: Date;
    /** Id of contest, didn't know _id existed */
    id: string;
    /** Name of contest */
    name: string;
    /** IDs of problems included in the contest */
    problemIds?: string[];
    /** Point value for each contest-local problem id */
    problemPoints?: Map<string, number> | Record<string, number>;
    /** Legacy embedded problems, kept only for old database rows */
    problems?: IProblemWithTestcases[];
    /** When the contest starts */
    startTime: Date;
    /** Shared schedule or per-user timed starts */
    timingMode: "global" | "personal";
}

/**
 * A user's personal contest timer.
 */
export interface IContestAttempt {
    /** Public contest id */
    contestId: string;
    /** When this user's scoring window closes */
    endsAt: Date;
    /** When this user started the contest */
    startedAt: Date;
    /** User taking the contest */
    userId: Types.ObjectId;
}

/**
 * Password reset token interface
 * @remarks Tokens are stored as hashes so leaked DB rows cannot reset accounts.
 */
export interface IPasswordReset {
    /** When this reset token expires */
    expiresAt: Date;
    /** Hash of the reset token sent to the user */
    tokenHash: string;
    /** User requesting the reset */
    userId: Types.ObjectId;
}

/**
 * Problem Interface
 * @remarks used for mongoose stuff
 */
export interface IProblem {
    /** ID of the contest it's part of, if applicable */
    contestID?: null | string;
    /** didn't know _id existed, CANNOT HAVE COLONS */
    id: string;
    /** Describes the input format */
    inputFormat: string;
    /** Is the problem private */
    isPrivate?: boolean;
    /** problem name */
    name: string;
    /** Number of sample testcases */
    numSampleTestcases: number;
    /** Describes the output format */
    outputFormat: string;
    /** Describes the problem */
    problemStatement: string;
    /** Whitelist if the problem is private */
    whitelist?: Types.ObjectId[];
}

/**
 * Judge-only testcase data for a problem.
 */
export interface IProblemTestcase {
    /** Contest id for contest-scoped problems */
    contestId?: null | string;
    /** Input text */
    input: string;
    /** Whether this testcase is public sample data */
    isSample: boolean;
    /** Zero-based testcase order */
    order: number;
    /** Expected output text */
    output: string;
    /** Public problem id */
    problemId: string;
}

/**
 * Problem plus testcase arrays used by render and judge paths.
 */
export interface IProblemWithTestcases extends IProblem {
    /** Input testcases */
    inputTestcases: string[];
    /** Output testcases */
    outputTestcases: string[];
}

/**
 * Result interface
 */
export interface IResult {
    /** MB */
    mem: string;
    /** result of testcase */
    status: "..." | "AC" | "MLE" | "RTE" | "TLE" | "WA";
    /** seconds as a string */
    time: string;
}

/**
 * Stored submission.
 */
export interface ISubmission {
    /** Submitted source code */
    code: string;
    /** When judging finished */
    completedAt?: Date;
    /** Contest id, when submitted inside a contest */
    contestId?: null | string;
    /** Whether this submission counts toward contest results */
    contestScored?: boolean;
    /** Error message when judging failed */
    error?: string;
    /** Stable key for idempotent legacy migrations */
    legacyKey?: string;
    /** Public problem id, scoped by contestId when present */
    problemId: string;
    /** Latest known testcase results */
    results: IResult[];
    /** Current judging state */
    status: "completed" | "failed" | "queued" | "running";
    /** User that submitted */
    userId: Types.ObjectId;
}

/**
 * User interface
 * @remarks Used for mongoose stuff
 */
export interface IUser {
    /** has admin privelleges */
    admin?: boolean;
    /** email address */
    email: string;
    /** encrypted password */
    password: string;
    /** token to verify email */
    verificationToken?: string;
    /** when the verification token expires */
    verificationTokenExpiresAt?: Date;
    /** has verified email */
    verified?: boolean;
}
