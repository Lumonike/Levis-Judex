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

const page = document.querySelector("[data-club-id]");
const clubId = page?.dataset.clubId ?? "";
let currentClub = null;
let openRosterKind = null;

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

async function loadClub() {
    try {
        const parsed = await api(`/api/clubs/${encodeURIComponent(clubId)}`);
        renderClub(parsed.club, parsed.contests ?? []);
        if (openRosterKind && document.getElementById("club-roster-dialog").open) {
            renderRosterDialog(openRosterKind);
        }
    } catch (error) {
        document.getElementById("club-summary").textContent = error.message;
    }
}

function renderClub(club, contests) {
    currentClub = club;
    const canManage = club.role === "admin" || club.role === "owner";
    document.getElementById("club-name").textContent = club.name;
    document.getElementById("club-summary").textContent = `${club.id} · ${roleLabel(club)}`;
    document.getElementById("club-stats").innerHTML = `
        ${statMarkup("members", "Members", club.memberEmails.length, canManage)}
        ${
            canManage
                ? `${statMarkup("invites", "Pending invites", club.inviteEmails.length, true)}
                    ${statMarkup("requests", "Join requests", club.requestEmails.length, true)}`
                : statMarkup("contests", "Contests", contests.length, false)
        }
    `;
    document.getElementById("club-primary-actions").innerHTML = primaryActionsMarkup(club);
    document.getElementById("club-contest-actions").innerHTML = canManage
        ? `<a class="btn" href="/clubs/${encodeURIComponent(club.id)}/add-contest">Create Contest</a>`
        : "";
    renderContests(club, contests);
    renderManagement(club, canManage);
    wireActions(club);
}

function primaryActionsMarkup(club) {
    if (club.role === "member") {
        return `<button data-action="leave" class="btn btn-danger" type="button">Leave Club</button>`;
    }
    return "";
}

function renderContests(club, contests) {
    const container = document.getElementById("club-contests");
    const canManage = club.role === "admin" || club.role === "owner";
    if (contests.length === 0) {
        container.innerHTML = `<div class="panel panel-body"><p class="section-note">No contests have been created for this club yet.</p></div>`;
        return;
    }

    container.innerHTML = contests
        .map(
            (contest, index) => `
                <div class="list-row">
                    <div class="flex min-w-0 items-center gap-4">
                        <span class="id-pill">${(index + 1).toString()}</span>
                        <div class="min-w-0">
                            <p class="m-0 truncate font-medium">${escapeText(contest.name)}</p>
                            <p class="m-0 text-sm muted">ID: ${escapeText(contest.id)} · ${formatDate(contest.startTime)} - ${formatDate(contest.endTime)}</p>
                        </div>
                    </div>
                    <span class="flex flex-wrap justify-end gap-2">
                        <a class="btn btn-secondary" href="/contests/${encodeURIComponent(contest.id)}?club=${encodeURIComponent(club.id)}">Open</a>
                        ${
                            canManage
                                ? `<a class="btn" href="/clubs/${encodeURIComponent(club.id)}/contests/${encodeURIComponent(contest.id)}/edit">Edit</a>`
                                : ""
                        }
                    </span>
                </div>
            `,
        )
        .join("");
}

function renderManagement(club, canManage) {
    const panel = document.getElementById("club-management");
    const body = document.getElementById("club-management-body");
    panel.classList.toggle("hidden", !canManage);
    if (!canManage) {
        body.innerHTML = "";
        return;
    }

    const inviteCode = club.inviteCode ?? "";
    const inviteLink = inviteCode ? `${window.location.origin}/clubs?code=${encodeURIComponent(inviteCode)}` : "";
    body.innerHTML = `
        <div class="club-management-layout">
            <div class="club-management-main">
                <div class="club-control-row club-code-row">
                    <div>
                        <label for="club-invite-code">Invite code</label>
                        <input id="club-invite-code" readonly value="${escapeAttr(inviteCode)}">
                    </div>
                    <button data-action="copy-code" class="btn" type="button">Copy Link</button>
                    <button data-action="regenerate-code" class="btn" type="button">New Code</button>
                    <input data-role="invite-link" type="hidden" value="${escapeAttr(inviteLink)}">
                </div>

                <form id="rename-club-form" class="club-control-row">
                    <div>
                        <label for="club-name-field">Club name</label>
                        <input id="club-name-field" maxlength="80" value="${escapeAttr(club.name)}">
                    </div>
                    <button class="btn" type="submit">Save Name</button>
                </form>

                <div class="club-control-row club-email-invite">
                    <div>
                        <label for="invite-email">Email invite link</label>
                        <input id="invite-email" data-role="invite-email" type="email" placeholder="student@example.com">
                    </div>
                    <button data-action="invite" class="btn" type="button">Email Link</button>
                </div>
            </div>

            <div class="club-management-danger">
                <button data-action="delete-club" class="btn btn-danger" type="button">Delete Club</button>
            </div>
        </div>
    `;
}

function emailListMarkup(emails, action) {
    if (emails.length === 0) {
        return `<p class="club-roster-empty">None</p>`;
    }

    return `
        <div class="club-roster-list">
            ${emails
                .map(
                    (email) => `
                        <div class="club-roster-item">
                            <span>${escapeText(email)}</span>
                            ${emailActionMarkup(action, email)}
                        </div>
                    `,
                )
                .join("")}
        </div>
    `;
}

function emailActionMarkup(action, email) {
    if (action === "request") {
        return `<span class="flex gap-1">
            <button data-action="approve" data-email="${escapeAttr(email)}" class="btn" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">Approve</button>
            <button data-action="decline" data-email="${escapeAttr(email)}" class="btn btn-secondary" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">Decline</button>
        </span>`;
    }

    const label = action === "cancel-invite" ? "Cancel" : "Remove";
    return `<button data-action="kick" data-email="${escapeAttr(email)}" class="btn btn-danger" style="min-height: 2rem; padding: .25rem .5rem; font-size: .78rem;">${label}</button>`;
}

function statMarkup(kind, label, value, canOpen) {
    const content = `<p class="m-0 text-2xl font-semibold">${escapeText(value)}</p><p class="m-0 text-sm muted">${label}</p>`;
    if (!canOpen) {
        return `<div class="panel panel-body">${content}</div>`;
    }

    return `<button class="club-stat-card panel panel-body" data-action="open-roster" data-roster-kind="${kind}" type="button">${content}</button>`;
}

function wireActions(club) {
    document.querySelector("[data-action='leave']")?.addEventListener("click", () => runClubAction(`/api/clubs/${club.id}/leave`, {}));
    document
        .querySelector("[data-action='invite']")
        ?.addEventListener("click", () =>
            runClubAction(`/api/clubs/${club.id}/invite`, { email: document.querySelector("[data-role='invite-email']").value }),
        );
    document.querySelector("[data-action='copy-code']")?.addEventListener("click", copyInviteLink);
    document.querySelector("[data-action='regenerate-code']")?.addEventListener("click", () => regenerateInviteCode(club));
    document.querySelector("[data-action='delete-club']")?.addEventListener("click", () => deleteClub(club));
    document.getElementById("rename-club-form")?.addEventListener("submit", (event) => renameClub(event, club));
    document.querySelectorAll("[data-action='open-roster']").forEach((button) => {
        button.addEventListener("click", () => openRosterDialog(button.dataset.rosterKind));
    });
    wireRosterItemActions(document, club);
    wireRosterDialog();
}

function wireRosterItemActions(container, club) {
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

function openRosterDialog(kind) {
    openRosterKind = kind;
    renderRosterDialog(kind);
    const dialog = document.getElementById("club-roster-dialog");
    if (!dialog.open) {
        dialog.showModal();
    }
}

function renderRosterDialog(kind) {
    if (!currentClub) {
        return;
    }
    const config = {
        invites: { action: "cancel-invite", emails: currentClub.inviteEmails, title: "Pending invites" },
        members: { action: "kick", emails: currentClub.memberEmails, title: "Members" },
        requests: { action: "request", emails: currentClub.requestEmails, title: "Join requests" },
    }[kind];
    if (!config) {
        return;
    }

    document.getElementById("club-roster-dialog-title").textContent = config.title;
    document.getElementById("club-roster-dialog-count").textContent =
        `${config.emails.length.toString()} ${config.emails.length === 1 ? "entry" : "entries"}`;
    const body = document.getElementById("club-roster-dialog-body");
    body.innerHTML = emailListMarkup(config.emails, config.action);
    wireRosterItemActions(body, currentClub);
}

function wireRosterDialog() {
    const dialog = document.getElementById("club-roster-dialog");
    const close = document.getElementById("club-roster-dialog-close");
    if (dialog.dataset.wired === "true") {
        return;
    }
    dialog.dataset.wired = "true";
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        openRosterKind = null;
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
}

async function renameClub(event, club) {
    event.preventDefault();
    try {
        const parsed = await api("/api/clubs/save", {
            body: JSON.stringify({
                id: club.id,
                mode: "update",
                name: document.getElementById("club-name-field").value.trim(),
            }),
            method: "POST",
        });
        alert(parsed.message);
        await loadClub();
    } catch (error) {
        alert(error.message);
    }
}

async function copyInviteLink() {
    const link = document.querySelector("[data-role='invite-link']")?.value;
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
        window.location.href = "/clubs";
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
        await loadClub();
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
        await loadClub();
    } catch (error) {
        alert(error.message);
    }
}

function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function roleLabel(club) {
    const labels = {
        admin: "Admin access",
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

void loadClub();
