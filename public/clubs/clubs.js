const getId = document.getElementById.bind(document);

async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
        ...options,
    });
    const parsed = await res.json();
    if (!res.ok) {
        throw new Error(parsed.message ?? parsed.error ?? "Request failed");
    }
    return parsed;
}

async function loadClubs() {
    try {
        const parsed = await api("/api/clubs/mine");
        renderClubs(parsed.clubs ?? []);
    } catch (error) {
        getId("club-list").innerHTML = `<p class="text-red-300">${escapeText(error.message)}</p>`;
    }
}

function renderClubs(clubs) {
    const list = getId("club-list");
    list.innerHTML = "";

    if (clubs.length === 0) {
        list.innerHTML = `<p class="text-gray-400">No clubs yet. Create one on the left, or ask an owner to invite you.</p>`;
        return;
    }

    clubs.forEach((club) => {
        const canManage = club.role === "admin" || club.role === "owner";
        const item = document.createElement("article");
        item.className = "rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-4";
        item.innerHTML = `
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-xl font-bold text-white">${escapeText(club.name)}</p>
                    <p class="text-sm text-blue-200">${escapeText(club.id)}</p>
                </div>
                <span class="w-fit rounded-full border border-gray-600 px-3 py-1 text-sm text-gray-200">${roleLabel(club)}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
                ${statMarkup("Members", club.memberEmails.length)}
                ${statMarkup("Invites", club.inviteEmails.length)}
                ${statMarkup("Requests", club.requestEmails.length)}
            </div>
            <div class="flex flex-wrap gap-2">${actionsMarkup(club)}</div>
            ${canManage ? managerMarkup(club) : ""}
        `;
        wireClubActions(item, club);
        list.appendChild(item);
    });
}

function actionsMarkup(club) {
    if (club.role === "invited") {
        return `<button data-action="join" class="rounded-lg bg-blue-500 px-3 py-2 font-semibold text-white hover:bg-blue-600">Accept Invite</button>
            <button data-action="leave" class="rounded-lg border border-gray-600 px-3 py-2 font-semibold text-gray-200 hover:bg-gray-700">Decline</button>`;
    }
    if (club.role === "visitor") {
        return `<button data-action="join" class="rounded-lg bg-blue-500 px-3 py-2 font-semibold text-white hover:bg-blue-600">${
            club.joinPolicy === "open" ? "Join Club" : "Request to Join"
        }</button>`;
    }
    if (club.role === "requested") {
        return `<button data-action="leave" class="rounded-lg border border-gray-600 px-3 py-2 font-semibold text-gray-200 hover:bg-gray-700">Cancel Request</button>`;
    }
    if (club.role === "member") {
        return `<button data-action="leave" class="rounded-lg border border-gray-600 px-3 py-2 font-semibold text-gray-200 hover:bg-gray-700">Leave Club</button>`;
    }
    return `<a href="/clubs/${encodeURIComponent(club.id)}/add-contest" class="rounded-lg bg-blue-500 px-3 py-2 font-semibold text-white hover:bg-blue-600">Create Contest</a>
        <button data-action="delete-club" class="rounded-lg border border-red-500 px-3 py-2 font-semibold text-red-200 hover:bg-red-900">Delete Club</button>`;
}

function managerMarkup(club) {
    return `
        <div class="space-y-3 border-t border-gray-700 pt-4">
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <textarea data-role="invite-emails" rows="3" placeholder="student@example.com&#10;another@example.com" class="rounded-lg border border-gray-600 bg-gray-900 p-3 text-white focus:border-blue-400 focus:outline-none"></textarea>
                <button data-action="invite" class="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600">Invite</button>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                ${emailListMarkup("Members", club.memberEmails, "kick")}
                ${emailListMarkup("Requests", club.requestEmails, "request")}
                ${emailListMarkup("Pending Invites", club.inviteEmails, "kick")}
            </div>
        </div>
    `;
}

function emailListMarkup(title, emails, action) {
    if (emails.length === 0) {
        return `<div><p class="mb-2 font-semibold text-white">${title}</p><p class="text-sm text-gray-400">None</p></div>`;
    }
    return `
        <div>
            <p class="mb-2 font-semibold text-white">${title}</p>
            <div class="space-y-2">
                ${emails
                    .map(
                        (email) => `
                    <div class="flex items-center justify-between gap-2 rounded-lg bg-gray-900 p-2">
                        <span class="truncate text-sm text-gray-200">${escapeText(email)}</span>
                        ${
                            action === "request"
                                ? `<span class="flex gap-1"><button data-action="approve" data-email="${escapeAttr(email)}" class="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white">Approve</button><button data-action="decline" data-email="${escapeAttr(email)}" class="rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white">Decline</button></span>`
                                : `<button data-action="kick" data-email="${escapeAttr(email)}" class="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">Remove</button>`
                        }
                    </div>`,
                    )
                    .join("")}
            </div>
        </div>
    `;
}

function statMarkup(label, value) {
    return `<div class="rounded-lg bg-gray-900 p-3"><p class="text-2xl font-bold text-white">${value}</p><p class="text-xs uppercase tracking-wide text-gray-400">${label}</p></div>`;
}

function wireClubActions(container, club) {
    container.querySelector("[data-action='join']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/join`, {}));
    container.querySelector("[data-action='leave']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/leave`, {}));
    container
        .querySelector("[data-action='invite']")
        ?.addEventListener("click", () =>
            runClubAction(`/api/clubs/${club.id}/invite`, { emails: container.querySelector("[data-role='invite-emails']").value }),
        );
    container.querySelector("[data-action='delete-club']")?.addEventListener("click", () => deleteClub(club));
    container.querySelectorAll("[data-action='kick']").forEach((button) => {
        button.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/kick`, { email: button.dataset.email }));
    });
    container.querySelectorAll("[data-action='approve'], [data-action='decline']").forEach((button) => {
        button.addEventListener("click", () =>
            runClubAction(`/api/clubs/${club.id}/respond-request`, {
                accept: button.dataset.action === "approve",
                email: button.dataset.email,
            }),
        );
    });
}

async function deleteClub(club) {
    if (!confirm(`Delete ${club.name}? This cannot be undone.`)) {
        return;
    }
    try {
        const parsed = await api(`/api/clubs/${club.id}`, { method: "DELETE" });
        alert(parsed.message);
        await loadClubs();
    } catch (error) {
        alert(error.message);
    }
}

async function runClubAction(path, body) {
    try {
        const parsed = await api(path, {
            body: JSON.stringify(body),
            method: "POST",
        });
        alert(parsed.message);
        await loadClubs();
    } catch (error) {
        alert(error.message);
    }
}

async function saveClub(event) {
    event.preventDefault();
    try {
        const parsed = await api("/api/clubs/save", {
            body: JSON.stringify({
                id: getId("club-id").value.trim(),
                joinPolicy: getId("join-policy").value,
                name: getId("club-name").value.trim(),
            }),
            method: "POST",
        });
        alert(parsed.message);
        await loadClubs();
    } catch (error) {
        alert(error.message);
    }
}

function roleLabel(club) {
    const labels = {
        admin: "Admin",
        invited: "Invited",
        member: "Member",
        owner: "Owner",
        requested: "Requested",
        visitor: club.joinPolicy === "open" ? "Open" : "Invite-only",
    };
    return labels[club.role] ?? club.role;
}

function escapeAttr(value) {
    return escapeText(value).replaceAll('"', "&quot;");
}

function escapeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

getId("club-form").addEventListener("submit", saveClub);
getId("refresh-clubs").addEventListener("click", loadClubs);
void loadClubs();
