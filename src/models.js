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
 * Stores Mongoose models
 * @module models
 */

/**
 * Properties of User model
 * @typedef {Object} UserModel
 * @property {string} email
 * @property {string} password encrypted
 * @property {boolean} [verified=false]
 * @property {string} verificationToken
 * @property {string} resetToken
 * @property {string} possibleNewPassword
 * @property {Object.<string, any>} results a map with the problems to the results
 * @property {Object.<string, any>} code a map with the problems to the code
 * @property {boolean} [admin=false]
 * @memberof module:models
 */

/**
 * Properties of Problem model
 * @typedef {Object} ProblemModel
 * @property {string} id didn't know _id existed, CANNOT HAVE COLONS
 * @property {string} name
 * @property {string} problemStatement
 * @property {string} inputFormat
 * @property {string} outputFormat
 * @property {number} numSampleTestcases
 * @property {string[]} inputTestcases
 * @property {string[]} outputTestcases
 * @property {string|null} [contestID=null]
 * @memberof module:models
 */

/**
 * Properties of Contest model
 * @typedef {Object} ContestModel
 * @property {string} id - didn't know _id existed
 * @property {string} name
 * @property {ProblemModel[]} problems
 * @property {Date} startTime
 * @property {Date} endTime
 * @memberof module:models
 */

const mongoose = require("mongoose");

const User = mongoose.model(
    "User",
    new mongoose.Schema({
        admin: { default: false, type: Boolean },
        code: { default: {}, type: Object },
        email: String,
        password: String,
        possibleNewPassword: String,
        resetToken: String,
        results: { default: {}, type: Object },
        verificationToken: String,
        verified: { default: false, type: Boolean },
    }),
);

const ProblemSchema = new mongoose.Schema({
    contestID: { default: null, type: String }, // null if not a contest problem
    id: String, // in case we want to do stuff like 5B like codeforces. CANNOT HAVE COLONS
    inputFormat: String,
    inputTestcases: [String],
    name: String,
    numSampleTestcases: Number,
    outputFormat: String,
    outputTestcases: [String],
    problemStatement: String,
});

const Problem = mongoose.model("Problem", ProblemSchema);

const Contest = mongoose.model(
    "Contest",
    new mongoose.Schema({
        endTime: Date,
        id: String,
        name: String,
        problems: [ProblemSchema],
        startTime: Date,
    }),
);

module.exports = { Contest, Problem, User };
