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

document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("register-form");
    const registerButton = document.getElementById("register-button");

    registerForm.addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent form submission

        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const registerData = {
            name: name,
            email: email,
            password: password,
        };

        fetch("/api/user/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(registerData),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log(data);
                if (!data.message) {
                    alert(data.error);
                } else {
                    alert(data.message);
                    window.location.href = "/login"; // Redirect to login page on successful registration
                }
            })
            .catch((error) => {
                console.error("Error:", error);
                alert("An error occurred. Please try again later.");
            });
    });
});
