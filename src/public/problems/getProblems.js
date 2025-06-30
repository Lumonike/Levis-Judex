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

async function loadProblems() {
    try {
        const response = await fetch(`${server}/problems/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const problems = await response.json();
        
        const list = document.getElementById("problem-list");
        problems.forEach(problem => {
            let p = document.createElement("p");
            let a = document.createElement("a");
            a.href = `../problems/${problem.id}`; 
            a.textContent = `${problem.id}. ${problem.name}`;
            p.appendChild(a);
            a.className = "hoverUnderline";
            list.appendChild(p);
        });
    } catch (error) {
        console.error("Error fetching problem list:", error);
    }
}

// Call the function asynchronously
loadProblems();
