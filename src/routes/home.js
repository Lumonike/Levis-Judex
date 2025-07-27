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
 * Home page routing
 * @module routes/home
 */

const express = require('express');

/**
 * Router for home page
 * @memberof module:routes/home
 */
const router = express.Router();
module.exports = router;

/**
 * @name GET/
 * @function 
 * @memberof module:routes/home
 * @returns Html for home page
 */
router.get('/', (req, res) => {
    res.render("home", { mainSection: { centered: true } });
});
