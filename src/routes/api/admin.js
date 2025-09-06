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
 * Admin API
 * @module api/admin
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const validator = require('validator');
const { User, Problem } = require('../../models.js');
const authenticateToken = require('../../authenticate.js');

/**
 * Router for admin
 * @memberof module:api/admin
 */
const router = express.Router();
module.exports = router;

/**
 * Ensures user is admin
 * @memberof module:api/admin
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
 * Sets the admin status 
 * @name POST/api/admin/set-admin-status 
 * @function 
 * @memberof module:api/admin 
 * @param {string} req.body.email User's email
 * @param {boolean} req.body.status What to set the user's admin status to
 * @returns {string | Object} Either error message or json {success: true}
 */
router.post("/set-admin-status", authenticateToken, requireAdmin, async (req, res) => {
    const { email, status } = req.body;
    
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Valid email is required" });
    }
    
    if (typeof status !== 'boolean') {
        return res.status(400).json({ error: "Status must be a boolean" });
    }
    
    const sanitizedEmail = validator.normalizeEmail(email.trim());
    if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
        return res.status(400).json({ error: "Invalid email address" });
    }
    
    console.log("attempting to change status of ", sanitizedEmail);
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
        return res.status(400).json({ error: "Failed to find user" });
    }
    user.admin = status;
    user.markModified("admin");
    await user.save();
    res.json({ success: true });
});

/**
 * Fetches admin page
 * @name POST/api/admin/get-admin-page
 * @function 
 * @memberof module:api/admin 
 * @param {string} req.body.folder What page
 * @returns Html page
 */
router.post("/get-admin-page", authenticateToken, requireAdmin, (req, res) => {
    const { folder } = req.body;
    
    if (!folder || typeof folder !== 'string') {
        return res.status(400).json({ message: "Invalid folder parameter" });
    }
    
    const sanitizedFolder = validator.escape(folder.trim());
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedFolder)) {
        return res.status(400).json({ message: "Invalid folder name" });
    }
    
    const filePath = path.join(__dirname, "..", "..", "views", "admin", `${sanitizedFolder}.ejs`);
    
    const expectedDir = path.join(__dirname, "..", "..", "views", "admin");
    if (!filePath.startsWith(expectedDir)) {
        return res.status(400).json({ message: "Invalid path" });
    }
    
    if (fs.existsSync(filePath)) {
        return res.render(`admin/${sanitizedFolder}`, {
            title: "Admin",
            mainSection: { centered: true },
            head: `<script src="${sanitizedFolder}.js" defer></script>`,
            backArrow: sanitizedFolder != "admin" ? { href: "/admin", text: "Back to Admin" } : { href: "/", text: "Back to Home" }
        });
    }
    res.status(400).json({ message: "Page doesn't exist" });
});

/**
 * Fetches admin page
 * @name POST/api/admin/save-problem
 * @function 
 * @memberof module:api/admin 
 * @param {Problem} req.body The new problem
 * @returns {String} Status code along with JSON with message member
 */
router.post("/save-problem", authenticateToken, requireAdmin, async (req, res) => {
    const update = {...req.body};
    
    if (!update.id || typeof update.id !== 'string') {
        return res.status(400).json({ message: "Problem ID is required and must be a string" });
    }
    
    if (!update.name || typeof update.name !== 'string') {
        return res.status(400).json({ message: "Problem name is required and must be a string" });
    }
    
    if (update.name.length > 200) {
        return res.status(400).json({ message: "Problem name must be less than 200 characters" });
    }
    
    if (update.problemStatement && typeof update.problemStatement !== 'string') {
        return res.status(400).json({ message: "Problem statement must be a string" });
    }
    
    if (update.inputFormat && typeof update.inputFormat !== 'string') {
        return res.status(400).json({ message: "Input format must be a string" });
    }
    
    if (update.outputFormat && typeof update.outputFormat !== 'string') {
        return res.status(400).json({ message: "Output format must be a string" });
    }
    
    if (update.numSampleTestcases && (typeof update.numSampleTestcases !== 'number' || update.numSampleTestcases < 0)) {
        return res.status(400).json({ message: "Number of sample testcases must be a non-negative number" });
    }
    
    if (update.inputTestcases && (!Array.isArray(update.inputTestcases) || !update.inputTestcases.every(tc => typeof tc === 'string'))) {
        return res.status(400).json({ message: "Input testcases must be an array of strings" });
    }
    
    if (update.outputTestcases && (!Array.isArray(update.outputTestcases) || !update.outputTestcases.every(tc => typeof tc === 'string'))) {
        return res.status(400).json({ message: "Output testcases must be an array of strings" });
    }
    
    if (update.contestID && typeof update.contestID !== 'string') {
        return res.status(400).json({ message: "Contest ID must be a string" });
    }
    
    try {
        const response = await Problem.findOneAndUpdate(
            { id: update.id },
            update,
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
        console.log(response);
        if (response) {
            res.status(200).json({ message: "Successfully updated problem!" });
        } else {
            res.status(400).json({ message: "Failed to update problem!" });
        }
    } catch (error) {
        console.error("Error saving problem:", error);
        res.status(500).json({ message: "Internal server error while saving problem" });
    }
});
