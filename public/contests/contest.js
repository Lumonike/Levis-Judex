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

const container = document.querySelector("[data-contest-id]");
const startButton = document.getElementById("start-contest-button");

if (container && startButton) {
    startButton.addEventListener("click", async () => {
        const contestID = container.dataset.contestId;
        const query = container.dataset.contestClubId ? `?club=${encodeURIComponent(container.dataset.contestClubId)}` : "";
        startButton.disabled = true;

        try {
            const res = await fetch(`/api/contests/${contestID}/start${query}`, {
                body: JSON.stringify({}),
                headers: { "Content-Type": "application/json" },
                method: "POST",
            });
            const parsed = await res.json();
            if (!res.ok) {
                throw new Error(parsed.error ?? "Failed to start contest");
            }
            window.location.reload();
        } catch (err) {
            alert(err.message);
            startButton.disabled = false;
        }
    });
}
