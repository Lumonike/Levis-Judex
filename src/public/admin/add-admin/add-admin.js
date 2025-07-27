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

function setAdmin(email, status, token) {
    fetch('/admin/set-admin-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({email, status})
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error("Failed to add admin");
        } else {
            alert("Changed admin status!");
        }
    })
    .catch(error => {
        alert("Failed: ", error);
    })
}

function setupButtons() {
    const addButton = document.getElementById('add-button');
    const removeButton = document.getElementById('remove-button');

    addButton.addEventListener('click', (event) => {
        event.preventDefault();

        const email = document.getElementById("user-to-add").value;
        const status = true;
        const token = localStorage.getItem("authToken");
        setAdmin(email, status, token);
    });

    removeButton.addEventListener('click', (event) => {
        event.preventDefault();

        const email = document.getElementById("user-to-remove").value;
        const status = false;
        const token = localStorage.getItem("authToken");
        setAdmin(email, status, token);
    });
}

document.addEventListener("DOMContentLoaded", setupButtons);
