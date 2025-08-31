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
const expressLayouts = require("express-ejs-layouts");

/**
 * App
 * @memberof module:server
 */
const app = express();

function parseTrustProxy(value) {
    if (value === undefined) return true;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const n = Number(value);
    if (!isNaN(n) && n >= 0) return n;
    return true;
}

const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
app.set('trust proxy', trustProxy);

// used to test trust proxy
// app.get('/ip', (request, response) => response.send(request.ip));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);

app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI).then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

app.use(express.static(path.join(__dirname, "public")));

app.use('/', (req, res, next) => {
    if (req.url.endsWith('.html')) {
        return res.redirect(req.url.slice(0, -"index.html".length));
    }
    next();
});

app.use("/", require("./routes/pages"));
app.use("/api", require("./routes/api"));

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

