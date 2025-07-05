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
 * Creates html for home page
 * @module pages/home 
 */

const fs = require('fs');
const path = require('path');
const html = require('../utils/html.js');

/**
 * Creates homepage
 * @name createHomeHtml
 * @function
 * @memberof module:pages/home
 * @returns {string} Html for homepage
 */
module.exports.createHomeHtml = () => {
    const document = html.baseDocument();
    const mainSection = document.getElementById("main-section");
    mainSection.className += ' text-center relative';
    mainSection.insertAdjacentHTML('afterbegin', fs.readFileSync(path.join(__dirname, "..", "templates", "partials", "home-page.html")));
    return document.documentElement.outerHTML;
}
