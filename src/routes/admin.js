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

const express = require('express');
const path = require('path');
const { User } = require('../models.js');
const authenticateToken = require('../authenticate.js');
const router = express.Router();
module.exports = router;

async function requireAdmin(req, res, next) {
    const user = await User.findById(req.user.id);
    if (user.admin) {
        next();
    } else {
        res.status(403).json("Invalid access");
    }
}

router.post("/getAdminPage", authenticateToken, requireAdmin, async (req, res) => {
    const { folder } = req.body;
    res.sendFile(path.join(__dirname, "..", "private", folder, "index.html"));
});

router.post("/setAdminStatus", authenticateToken, requireAdmin, async (req, res) => {
    const { email, status } = req.body;
    console.log("attempting to change status of ", email);
    const user = await User.findOne( { email: email });
    if (!user) {
        return res.status(400).send("Failed to find user");
    }
    user.admin = status;
    user.markModified("admin");
    await user.save();
    res.json({success: true});
});