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

const mongoose = require("mongoose");

const User = mongoose.model("User", new mongoose.Schema({
    email: String,
    password: String,
    verified: { type: Boolean, default: false },
    verificationToken: String,
    resetToken: String,
    possibleNewPassword: String,
    results: { type: Object, default: {} }, // basically a map with the problems to the results
    code: { type: Object, default: {} },
    admin: { type: Boolean, default: false }
}));

// making a schema to store it in problems
const ProblemSchema = new mongoose.Schema({
    id: String, // in case we want to do stuff like 5B like codeforces. CANNOT HAVE COLONS
    name: String,
    problemStatement: String,
    inputFormat: String,
    outputFormat: String,
    numSampleTestcases: Number,
    inputTestcases: [ String ],
    outputTestcases: [ String ],
    contestID: { type: String, default: null } // null if not a contest problem
});

const Problem = mongoose.model("Problem", ProblemSchema);

const Contest = mongoose.model("Contest", new mongoose.Schema({
    id: String,
    name: String,
    problems: [ ProblemSchema ],
    startTime: Date,
    endTime: Date
}));

module.exports = { User, Problem, Contest }
