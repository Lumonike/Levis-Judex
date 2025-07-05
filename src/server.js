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
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");

/**
 * App
 * @memberof module:server
 */
const app = express();

app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI).then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// require('./PORTING.js')();

app.use(express.static(path.join(__dirname, "public")));

// Middleware to block .html file requests
app.use('/', (req, res, next) => {
    if (req.url.endsWith('.html')) {
        return res.redirect(req.url.slice(0, -"index.html".length));
    }
    next();
});

app.use("/", require("./routes/home.js"));
app.use("/", require("./routes/user.js"));
app.use("/", require("./routes/problems.js"));
app.use("/", require("./routes/submit.js"));
app.use("/", require("./routes/contests.js"));
app.use("/admin", require("./routes/admin.js"));

// 🚀 **Start the Server**
app.listen(3000, () => console.log("Server running on port 3000"));

