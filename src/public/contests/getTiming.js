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

import { server } from "/problems/getServer.js";

export async function getTiming(contestID) {
    try {
        const response = await fetch(`${server}/contestTiming`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contestID: contestID })
        });
        const { startTime, endTime } = await response.json();
        return { startTime: new Date(startTime), endTime: new Date(endTime) };
    } catch (error) {
        console.error("Error fetching timing:", error);
    }
}

export function apply(elem, startTime, endTime) {
    const now = new Date();
    if (now < startTime) {
        const timeRemaining = startTime - now; // Time remaining in milliseconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        elem.innerHTML = `Starts in ${hours} hours, ${minutes} minutes, and ${seconds} seconds`;
    } else if (now >= startTime && now <= endTime) {
        const timeRemaining = endTime - now; // Time remaining in milliseconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        elem.innerHTML = `Contest is running! ${hours} hours, ${minutes} minutes, and ${seconds} seconds left`;
    } else {
        elem.innerHTML = `Contest ended at ${endTime.toLocaleString()}`;
    }
}