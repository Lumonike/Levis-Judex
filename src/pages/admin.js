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
 * Renders admin pages
 * @module pages/admin
 */

const html = require("../utils/html.js");

/**
 * Base admin page
 * @name createAdminHtml
 * @function
 * @memberof module:pages/admin
 * @param {string | null} [scriptSrc=null] Script source (if there is one) 
 * @returns {string} Html string
 */
module.exports.createBaseAdminHtml = (scriptSrc=null) => {
    const document = html.baseDocument();
    const mainSection = document.getElementById("main-section");
    mainSection.className += " text-center relative";
    mainSection.appendChild(html.title("Admin"));

    const loading = document.createElement('div');
    loading.className = html.text("", true, true).className;
    loading.innerHTML = "Loading...";
    loading.id = "admin-content";
    mainSection.appendChild(loading);

    if (scriptSrc != null) {
        const mainScript = document.createElement('script');
        mainScript.src = scriptSrc;
        mainSection.appendChild(mainScript);
    }

    const loadingScript = document.createElement('script');
    loadingScript.textContent = `
        async function loadAdminHTML() {
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = '/login';
                return;
            }
            const url = window.location.pathname.split("/");
            if (url.at(-1) == "") url.pop();
            const folder = url.at(-1);
            console.log(folder);
            const response = await fetch(\`/admin/get-admin-page\`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": \`Bearer \${token}\` 
                },
                body: JSON.stringify({ folder })
            });
            const content = document.getElementById("admin-content");
            if (!response.ok) {
                content.textContent = "Error: You do not have access to this page";
                return;
            }
            const html = await response.text();
            content.innerHTML = html;
            content.dispatchEvent(new Event('contentLoaded'));
        }
        loadAdminHTML();
    `;
    document.body.appendChild(loadingScript);

    return document.documentElement.outerHTML;
}
