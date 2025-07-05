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
 * Admin routing
 * @module routes/admin
 */

const express = require('express');
const path = require('path');
const { User } = require('../models.js');
const authenticateToken = require('../authenticate.js');
const { createBaseAdminHtml } = require('../pages/admin.js');

/**
 * Router for admin
 * @memberof module:routes/admin
 */
const router = express.Router();
module.exports = router;

/**
 * Ensures user is admin
 * @memberof module:routes/admin
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {express.NextFunction} next
 * @returns 403 error if not admin, otherwise calls next
 */
async function requireAdmin(req, res, next) {
    const user = await User.findById(req.user.id);
    if (user.admin) {
        next();
    } else {
        res.status(403).json("Invalid access");
    }
}

/**
 * Basic admin page
 * @name GET/
 * @function 
 * @memberof module:routes/admin
 * @returns HTML page
 */
router.get("/", (req, res) => {
    res.send(createBaseAdminHtml());
});

/**
 * Basic admin page
 * @name GET/:target
 * @function 
 * @memberof module:routes/admin
 * @returns HTML page
 */
router.get("/:target", (req, res) => {
    const target = req.params.target;
    res.send(createBaseAdminHtml(`${target}.js`));
});

/**
 * Sets the admin status 
 * @name POST/admin/set-admin-status 
 * @function 
 * @memberof module:routes/admin 
 * @param {string} req.body.email User's email
 * @param {boolean} req.body.status What to set the user's admin status to
 * @returns {string | Object} Either error message or json {success: true}
 */
router.post("/set-admin-status", authenticateToken, requireAdmin, async (req, res) => {
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

/**
 * Fetches admin page. TODO: This shouldn't exist
 * @name POST/admin/get-admin-page
 * @function 
 * @memberof module:routes/admin 
 * @param {string} req.body.folder What page
 * @returns Html page
 */
router.post("/get-admin-page", authenticateToken, requireAdmin, (req, res) => {
    const { folder } = req.body;
    res.sendFile(path.join(__dirname, "..", "templates", "partials", `${folder}.html`));
})
