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

import express, { Request, Response } from "express";
import validator from "validator";

import { MAX_CLUB_NAME_LENGTH } from "../lib/limits";
import { authenticateToken } from "../middleware/authenticate";
import { ClassClub, Contest, User } from "../models";
import {
    assertClubCreationLimit,
    buildClubInviteLink,
    canManageClub,
    deleteClubForUser,
    findUserManageableClubs,
    getClubRole,
    normalizeClubId,
    normalizeEmailList,
    notifyClubOwnerOfJoinRequest,
    regenerateClubInviteCode,
    requestClubWithInviteCode,
    requireClubInviteCode,
    serializeClub,
} from "../services/clubs";
import { transporter } from "../transporter";
import { ApiMessage } from "../types/api";

const router = express.Router();
export default router;

interface ClubSaveBody {
    id: string;
    mode?: "create" | "update";
    name: string;
}

interface CodeBody {
    code?: string;
}

interface EmailBody {
    email?: string;
    emails?: string | string[];
}

router.get("/mine", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id).select("email").lean();
    if (!user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const clubs = await ClassClub.find({
        $or: [{ ownerId: req.user.id }, { memberEmails: user.email }, { inviteEmails: user.email }, { requestEmails: user.email }],
    })
        .sort({ name: 1 })
        .lean();
    const serialized = await Promise.all(
        clubs.map(async (club) => {
            const role = await getClubRole(club, req.user?.id);
            if (role === "admin" || role === "owner") {
                await requireClubInviteCode(club);
            }
            return serializeClub(club, role);
        }),
    );

    return res.json({
        clubs: serialized,
        invited: serialized.filter((club) => club.role === "invited"),
        joined: serialized.filter((club) => club.role === "admin" || club.role === "member" || club.role === "owner"),
        requested: serialized.filter((club) => club.role === "requested"),
    });
});

router.get("/owned", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const clubs = await findUserManageableClubs(req.user.id);
    await Promise.all(clubs.map((club) => requireClubInviteCode(club)));
    return res.json({ clubs: clubs.map((club) => serializeClub(club, club.ownerId?.toString() === req.user?.id.toString() ? "owner" : "admin")) });
});

router.post("/save", authenticateToken, async (req: Request<unknown, ApiMessage, ClubSaveBody>, res: Response) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const id = normalizeClubId(req.body.id);
        const rawName = req.body.name.trim();
        const name = validator.escape(rawName);
        if (!id) {
            return res.status(400).json({ message: "Class/club ID is required" });
        }
        if (!rawName) {
            return res.status(400).json({ message: "Class/club name is required" });
        }
        if (rawName.length > MAX_CLUB_NAME_LENGTH) {
            return res.status(400).json({ message: `Class/club name must be ${MAX_CLUB_NAME_LENGTH.toString()} characters or fewer` });
        }

        const existing = await ClassClub.findOne({ id });
        if (existing && req.body.mode === "create") {
            return res.status(409).json({ message: "A club with that ID already exists" });
        }
        if (existing && !(await canManageClub(existing, req.user.id))) {
            return res.status(403).json({ message: "Only the club owner can edit this club" });
        }
        if (!existing) {
            await assertClubCreationLimit(req.user.id);
        }

        await ClassClub.findOneAndUpdate(
            { id },
            {
                $set: {
                    joinPolicy: "invite",
                    name,
                    ...(existing ? {} : { ownerId: req.user.id }),
                },
                $setOnInsert: {
                    inviteEmails: [],
                    memberEmails: [],
                    requestEmails: [],
                },
            },
            { new: true, setDefaultsOnInsert: true, upsert: true },
        );
        return res.json({ message: "Saved class/club." });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save class/club.";
        return res.status(400).json({ message });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) }).lean();
    if (!club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    const role = await getClubRole(club, req.user.id);
    if (role === "admin" || role === "owner") {
        await requireClubInviteCode(club);
    }
    if (role !== "admin" && role !== "member" && role !== "owner") {
        return res.status(403).json({ message: "You must be a member of this club to view it." });
    }
    const contests = await Contest.find({ clubId: club.id }).select("accessType endTime id name startTime timingMode").sort({ startTime: -1 }).lean();

    return res.json({ club: serializeClub(club, role), contests });
});

router.delete("/:id", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        await deleteClubForUser(normalizeClubId(req.params.id), req.user.id);
        return res.json({ message: "Deleted class/club." });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete class/club.";
        const status = message === "Class/club not found" ? 404 : message.startsWith("Only the club owner") ? 403 : 400;
        return res.status(status).json({ message });
    }
});

router.post("/:id/invite", authenticateToken, async (req: Request<{ id: string }, ApiMessage, EmailBody>, res: Response) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    if (!(await canManageClub(club, req.user.id))) {
        return res.status(403).json({ message: "Only the club owner can invite students" });
    }

    const emails = normalizeEmailList(req.body.email ? [req.body.email] : req.body.emails);
    if (emails.length === 0) {
        return res.status(400).json({ message: "Enter at least one valid email address" });
    }

    const inviteCode = await requireClubInviteCode(club);
    const link = buildClubInviteLink(inviteCode);
    club.inviteEmails = [...new Set([...(club.inviteEmails ?? []), ...emails])];
    await club.save();
    await Promise.all(
        emails.map((email) =>
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                subject: `Join ${club.name}`,
                text: `You were invited to join ${club.name} on Code Joint.\n\nOpen this link and sign in to join: ${link}\n\nInvite code: ${inviteCode}`,
                to: email,
            }),
        ),
    );

    return res.json({ message: `Sent ${emails.length.toString()} invite link${emails.length === 1 ? "" : "s"}.` });
});

router.post("/:id/regenerate-code", authenticateToken, async (req: Request<{ id: string }, ApiMessage>, res: Response) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    if (!(await canManageClub(club, req.user.id))) {
        return res.status(403).json({ message: "Only the club owner can change invite codes" });
    }

    const inviteCode = await regenerateClubInviteCode(club);
    return res.json({ inviteCode, message: "Invite code changed." });
});

router.post("/:id/kick", authenticateToken, async (req: Request<{ id: string }, ApiMessage, EmailBody>, res: Response) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    if (!(await canManageClub(club, req.user.id))) {
        return res.status(403).json({ message: "Only the club owner can remove students" });
    }

    const emails = normalizeEmailList(req.body.email ? [req.body.email] : req.body.emails);
    club.memberEmails = club.memberEmails.filter((email) => !emails.includes(email));
    club.inviteEmails = (club.inviteEmails ?? []).filter((email) => !emails.includes(email));
    club.requestEmails = (club.requestEmails ?? []).filter((email) => !emails.includes(email));
    await club.save();

    return res.json({ message: "Updated roster." });
});

router.post("/:id/join", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const user = await User.findById(req.user.id).select("email").lean();
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!user || !club) {
        return res.status(404).json({ message: "Class/club not found" });
    }

    if (club.memberEmails.includes(user.email)) {
        return res.json({ message: "You are already a member." });
    }
    if ((club.inviteEmails ?? []).includes(user.email)) {
        club.memberEmails = [...new Set([user.email, ...club.memberEmails])];
        club.inviteEmails = (club.inviteEmails ?? []).filter((email) => email !== user.email);
        club.requestEmails = (club.requestEmails ?? []).filter((email) => email !== user.email);
        await club.save();
        return res.json({ message: "Joined class/club." });
    }

    return res.status(400).json({ message: "Enter an invite code to join this club." });
});

router.post("/join-code", authenticateToken, async (req: Request<unknown, ApiMessage, CodeBody>, res: Response) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const result = await requestClubWithInviteCode(req.user.id, req.body.code ?? "");
        if (result.requestCreated) {
            void notifyClubOwnerOfJoinRequest(result.club, result.requesterEmail);
        }

        const messages = {
            "already-member": `You are already a member of ${result.club.name}.`,
            "already-requested": `Request already sent to ${result.club.name}.`,
            joined: `Joined ${result.club.name}.`,
            requested: `Request sent to ${result.club.name}.`,
        };
        return res.json({ message: messages[result.status] });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to request club access.";
        return res.status(400).json({ message });
    }
});

router.post("/:id/leave", authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const user = await User.findById(req.user.id).select("email").lean();
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!user || !club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    if (club.ownerId?.toString() === req.user.id.toString()) {
        return res.status(400).json({ message: "Owners cannot leave their own club." });
    }

    club.memberEmails = club.memberEmails.filter((email) => email !== user.email);
    club.inviteEmails = (club.inviteEmails ?? []).filter((email) => email !== user.email);
    club.requestEmails = (club.requestEmails ?? []).filter((email) => email !== user.email);
    await club.save();

    return res.json({ message: "Left class/club." });
});

router.post("/:id/respond-request", authenticateToken, async (req: Request<{ id: string }, ApiMessage, EmailBody & { accept?: boolean }>, res) => {
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    const club = await ClassClub.findOne({ id: normalizeClubId(req.params.id) });
    if (!club) {
        return res.status(404).json({ message: "Class/club not found" });
    }
    if (!(await canManageClub(club, req.user.id))) {
        return res.status(403).json({ message: "Only the club owner can approve requests" });
    }
    const email = normalizeEmailList(req.body.email ? [req.body.email] : [])[0];
    if (!email) {
        return res.status(400).json({ message: "Valid student email is required" });
    }

    club.requestEmails = (club.requestEmails ?? []).filter((requestedEmail) => requestedEmail !== email);
    if (req.body.accept) {
        club.memberEmails = [...new Set([email, ...club.memberEmails])];
        club.inviteEmails = (club.inviteEmails ?? []).filter((inviteEmail) => inviteEmail !== email);
    }
    await club.save();
    return res.json({ message: req.body.accept ? "Request approved." : "Request declined." });
});
