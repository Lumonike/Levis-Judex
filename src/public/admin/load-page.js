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

    const response = await fetch(`/api/admin/get-admin-page`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ folder })
    });
    const content = document.getElementById("admin-content");
    console.log(response);
    if (!response.ok) {
        content.textContent = "Error: You do not have access to this page";
        return;
    }
    const html = await response.text();
    // content.innerHTML = html;
    document.open();
    document.write(html);
    document.close();
}
loadAdminHTML();