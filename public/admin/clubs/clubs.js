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

const getId = document.getElementById.bind(document);

async function loadClubs() {
    const res = await fetch("/api/admin/list-clubs");
    const parsed = await res.json();
    if (!res.ok) {
        alert(parsed.message ?? "Failed to load classes/clubs.");
        return;
    }

    renderClubs(parsed.clubs ?? []);
}

function renderClubs(clubs) {
    const list = getId("club-list");
    list.innerHTML = "";

    if (clubs.length === 0) {
        list.innerHTML = `<p class="text-gray-400">No classes or clubs yet.</p>`;
        return;
    }

    clubs.forEach((club) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "text-left rounded-lg border border-gray-600 bg-gray-800 p-4 hover:bg-gray-600 transition-colors";
        item.innerHTML = `
            <p class="text-xl font-semibold text-white">${escapeText(club.name)}</p>
            <p class="text-sm text-blue-200">${escapeText(club.id)}</p>
            <p class="text-sm text-gray-300 mt-2">${(club.memberEmails ?? []).length} students</p>
        `;
        item.addEventListener("click", () => {
            getId("club-id").value = club.id;
            getId("club-name").value = club.name;
            getId("member-emails").value = (club.memberEmails ?? []).join("\n");
        });
        list.appendChild(item);
    });
}

async function saveClub(event) {
    event.preventDefault();
    const club = {
        id: getId("club-id").value.trim(),
        memberEmails: getId("member-emails").value,
        name: getId("club-name").value.trim(),
    };

    const res = await fetch("/api/admin/save-club", {
        body: JSON.stringify(club),
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });
    const parsed = await res.json();
    if (!res.ok) {
        alert(parsed.message ?? "Failed to save class/club.");
        return;
    }

    alert(parsed.message);
    await loadClubs();
}

function escapeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

getId("club-form").addEventListener("submit", saveClub);
void loadClubs();
