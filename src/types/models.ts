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
 * Contest interface
 * @remarks used for mongoose stuff
 */
export interface IContest {
    /** When the contest ends */
    endTime: Date;
    /** Id of contest, didn't know _id existed */
    id: string;
    /** Name of contest */
    name: string;
    /** Problems of the contest */
    problems: IProblem[];
    /** When the contest starts */
    startTime: Date;
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
    /** Input testcases */
    inputTestcases: string[];
    /** Is the problem private */
    isPrivate?: boolean;
    /** problem name */
    name: string;
    /** Number of sample testcases */
    numSampleTestcases: number;
    /** Describes the output format */
    outputFormat: string;
    /** Output testcases */
    outputTestcases: string[];
    /** Describes the problem */
    problemStatement: string;
    /** Whitelist if the problem is private */
    whitelist?: Types.ObjectId[];
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
 * User interface
 * @remarks Used for mongoose stuff
 */
export interface IUser {
    /** has admin privelleges */
    admin?: boolean;
    /** Map with problemId as the key and points to code user submitted for that problem */
    code: Map<string, string>;
    /** email address */
    email: string;
    /** encrypted password */
    password: string;
    /** possible new password when resetting password */
    possibleNewPassword?: string;
    /** token to reset password */
    resetToken?: string;
    /** Map with problemId as the key and points to results */
    results: Map<string, IResult[]>;
    /** token to verify email */
    verificationToken?: string;
    /** has verified email */
    verified?: boolean;
}
