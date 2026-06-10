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
        list.innerHTML = `<p class="section-note">No clubs yet. Enter an invite code to join one.</p>`;
        return;
    }

    clubs.forEach((club) => {
        const canManage = club.role === "admin" || club.role === "owner";
        const item = document.createElement("article");
        item.className = "panel panel-body space-y-4";
        item.innerHTML = `
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="m-0 text-xl font-bold">${escapeText(club.name)}</p>
                    <p class="m-0 text-sm muted">${escapeText(club.id)}</p>
                </div>
                <span class="badge">${roleLabel(club)}</span>
            </div>
            <div class="grid grid-cols-1 gap-2 text-center">
                ${statMarkup("Members", club.memberEmails.length)}
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
        return `<button data-action="join" class="btn">Join Club</button>
            <button data-action="leave" class="btn btn-secondary">Decline</button>`;
    }
    if (club.role === "visitor") {
        return "";
    }
    if (club.role === "requested") {
        return `<button data-action="leave" class="btn btn-secondary">Cancel Request</button>`;
    }
    if (club.role === "member") {
        return `<button data-action="leave" class="btn btn-secondary">Leave Club</button>`;
    }
    return `<a href="/clubs/${encodeURIComponent(club.id)}/add-contest" class="btn">Create Contest</a>
        <button data-action="delete-club" class="btn btn-danger">Delete Club</button>`;
}

function managerMarkup(club) {
    const inviteCode = club.inviteCode ?? "";
    const inviteLink = inviteCode ? `${window.location.origin}/clubs?code=${encodeURIComponent(inviteCode)}` : "";
    return `
        <div class="space-y-3 border-t pt-4" style="border-color: var(--line)">
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <div>
                    <label>Invite code</label>
                    <input data-role="invite-code" readonly value="${escapeAttr(inviteCode)}">
                </div>
                <button data-action="copy-code" class="btn btn-secondary" type="button">Copy Link</button>
                <button data-action="regenerate-code" class="btn btn-secondary" type="button">New Code</button>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <textarea data-role="invite-emails" rows="3" placeholder="student@example.com&#10;another@example.com"></textarea>
                <button data-action="invite" class="btn">Email Link</button>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                ${emailListMarkup("Members", club.memberEmails, "kick")}
            </div>
            <input data-role="invite-link" type="hidden" value="${escapeAttr(inviteLink)}">
        </div>
    `;
}

function emailListMarkup(title, emails, action) {
    if (emails.length === 0) {
        return `<div><p class="mb-2 font-semibold">${title}</p><p class="text-sm muted">None</p></div>`;
    }
    return `
        <div>
            <p class="mb-2 font-semibold">${title}</p>
            <div class="space-y-2">
                ${emails
                    .map(
                        (email) => `
                    <div class="flex items-center justify-between gap-2 rounded-lg p-2" style="background: var(--panel-strong)">
                        <span class="truncate text-sm">${escapeText(email)}</span>
                        ${
                            action === "request"
                                ? `<span class="flex gap-1"><button data-action="approve" data-email="${escapeAttr(email)}" class="btn" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">Approve</button><button data-action="decline" data-email="${escapeAttr(email)}" class="btn btn-secondary" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">Decline</button></span>`
                                : `<button data-action="kick" data-email="${escapeAttr(email)}" class="btn btn-danger" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">Remove</button>`
                        }
                    </div>`,
                    )
                    .join("")}
            </div>
        </div>
    `;
}

function statMarkup(label, value) {
    return `<div class="rounded-lg p-3" style="background: var(--panel-strong)"><p class="m-0 text-xl font-semibold">${escapeText(value)}</p><p class="m-0 text-xs uppercase tracking-wide muted">${label}</p></div>`;
}

function wireClubActions(container, club) {
    container.querySelector("[data-action='join']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/join`, {}));
    container.querySelector("[data-action='leave']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/leave`, {}));
    container
        .querySelector("[data-action='invite']")
        ?.addEventListener("click", () =>
            runClubAction(`/api/clubs/${club.id}/invite`, { emails: container.querySelector("[data-role='invite-emails']").value }),
        );
    container.querySelector("[data-action='copy-code']")?.addEventListener("click", () => copyInviteLink(container));
    container.querySelector("[data-action='regenerate-code']")?.addEventListener("click", () => regenerateInviteCode(club));
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

async function copyInviteLink(container) {
    const link = container.querySelector("[data-role='invite-link']")?.value;
    if (!link) {
        alert("This club does not have an invite code yet.");
        return;
    }
    try {
        await window.navigator.clipboard.writeText(link);
        alert("Invite link copied.");
    } catch {
        window.prompt("Copy this invite link:", link);
    }
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

async function regenerateInviteCode(club) {
    if (!confirm(`Create a new invite code for ${club.name}? Old invite links will stop working.`)) {
        return;
    }
    try {
        const parsed = await api(`/api/clubs/${club.id}/regenerate-code`, { method: "POST" });
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
        visitor: "Invite-only",
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
getId("join-code-form").addEventListener("submit", joinByCode);
getId("refresh-clubs").addEventListener("click", loadClubs);
const codeFromUrl = new window.URLSearchParams(window.location.search).get("code");
if (codeFromUrl) {
    getId("invite-code").value = codeFromUrl;
    getId("invite-code").focus();
}
void loadClubs();
