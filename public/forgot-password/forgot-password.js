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
    const resetForm = document.getElementById("reset-form");
    const completeResetForm = document.getElementById("complete-reset-form");

    if (resetForm)
        resetForm.addEventListener("submit", function (event) {
            event.preventDefault(); // Prevent form submission

            const email = document.getElementById("email").value;

            const resetData = {
                email: email,
            };

            fetch("/api/user/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(resetData),
            })
                .then((response) => response.json())
                .then((data) => {
                    console.log(data);
                    if (!data.message) {
                        alert(data.error);
                    } else {
                        alert(data.message);
                        window.location.href = "/login";
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);
                    alert("An error occurred. Please try again later.");
                });
        });

    if (completeResetForm)
        completeResetForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const password = document.getElementById("password").value;
            const token = document.getElementById("reset-token").value;

            fetch("/api/user/complete-reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password, token }),
            })
                .then((response) => response.json())
                .then((data) => {
                    if (!data.success) {
                        alert(data.error);
                    } else {
                        alert(data.success);
                        window.location.href = "/login";
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);
                    alert("An error occurred. Please try again later.");
                });
        });
});
