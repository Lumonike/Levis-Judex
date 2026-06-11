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
        getId("club-list").innerHTML = `<p class="text-red-600">${escapeText(error.message)}</p>`;
    }
}

function renderClubs(clubs) {
    const list = getId("club-list");
    list.innerHTML = "";

    if (clubs.length === 0) {
        list.innerHTML = `<p class="section-note">No clubs yet. Enter an invite code to join one.</p>`;
        return;
    }

    clubs.forEach((club) => {
        const item = document.createElement("article");
        item.className = "panel panel-body space-y-4";
        item.innerHTML = `
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                    <p class="m-0 truncate text-lg font-semibold">${escapeText(club.name)}</p>
                    <p class="m-0 text-sm muted">${escapeText(club.id)}</p>
                </div>
                <span class="badge">${roleLabel(club)}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-center">
                ${statMarkup("Members", club.memberEmails.length)}
                ${statMarkup("Invites", club.inviteEmails.length)}
            </div>
            <div class="flex flex-wrap gap-2">${actionsMarkup(club)}</div>
        `;
        wireClubActions(item, club);
        list.appendChild(item);
    });
}

function actionsMarkup(club) {
    if (club.role === "invited") {
        return `<button data-action="join" class="btn">Request Access</button>
            <button data-action="leave" class="btn btn-secondary">Decline</button>`;
    }
    if (club.role === "requested") {
        return `<button data-action="leave" class="btn btn-secondary">Cancel Request</button>`;
    }
    if (club.role === "visitor") {
        return "";
    }

    return `<a href="/clubs/${encodeURIComponent(club.id)}" class="btn">Open Club</a>`;
}

function statMarkup(label, value) {
    return `<div class="rounded-lg p-3" style="background: var(--panel-strong)"><p class="m-0 text-xl font-semibold">${escapeText(value)}</p><p class="m-0 text-xs uppercase tracking-wide muted">${label}</p></div>`;
}

function wireClubActions(container, club) {
    container.querySelector("[data-action='join']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/join`, {}));
    container.querySelector("[data-action='leave']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/leave`, {}));
}

async function joinByCode(event) {
    event.preventDefault();
    try {
        const parsed = await api("/api/clubs/join-code", {
            body: JSON.stringify({ code: getId("invite-code").value.trim() }),
            method: "POST",
        });
        alert(parsed.message);
        getId("invite-code").value = "";
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
                mode: "create",
                name: getId("club-name").value.trim(),
            }),
            method: "POST",
        });
        alert(parsed.message);
        getId("club-id").value = "";
        getId("club-name").value = "";
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
        visitor: "Invite-only",
    };
    return labels[club.role] ?? club.role;
}

function escapeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

getId("club-form").addEventListener("submit", saveClub);
getId("join-code-form").addEventListener("submit", joinByCode);
getId("refresh-clubs").addEventListener("click", loadClubs);

const codeFromUrl = new window.URLSearchParams(window.location.search).get("code");
if (codeFromUrl) {
    getId("invite-code").value = codeFromUrl;
    getId("invite-code").focus();
}
void loadClubs();
