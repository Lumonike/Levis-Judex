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

import { Types } from "mongoose";
import validator from "validator";

import { createClubInviteCode, normalizeClubInviteCode } from "../lib/invite-codes";
import { MAX_CLUBS_PER_OWNER } from "../lib/limits";
import { ClassClub, Contest, User } from "../models";
import { transporter } from "../transporter";
import { IClassClub } from "../types/models";

export interface ClubJoinResult {
    club: IClassClub;
    requestCreated: boolean;
    requesterEmail: string;
    status: ClubJoinStatus;
}

export type ClubJoinStatus = "already-member" | "already-requested" | "joined" | "requested";
export type ClubRole = "admin" | "invited" | "member" | "owner" | "requested" | "visitor";

export interface ClubView {
    id: string;
    inviteCode?: string;
    inviteEmails: string[];
    joinPolicy: "invite";
    memberEmails: string[];
    name: string;
    ownerId?: string;
    requestEmails: string[];
    role: ClubRole;
}

export async function assertClubCreationLimit(userId: Types.ObjectId): Promise<void> {
    const existingClubCount = await ClassClub.countDocuments({ ownerId: userId });
    if (existingClubCount >= MAX_CLUBS_PER_OWNER) {
        throw new Error(`You can create up to ${MAX_CLUBS_PER_OWNER.toString()} clubs.`);
    }
}

export function buildClubInviteLink(inviteCode: string): string {
    const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
    const url = new URL("/clubs", baseUrl);
    url.searchParams.set("code", inviteCode);
    return url.toString();
}

export async function canManageClub(club: IClassClub, userId: Types.ObjectId): Promise<boolean> {
    const user = await User.findById(userId).select("admin").lean();
    return user?.admin === true || club.ownerId?.toString() === userId.toString();
}

export async function deleteClubForUser(clubId: string, userId: Types.ObjectId): Promise<void> {
    const club = await ClassClub.findOne({ id: clubId });
    if (!club) {
        throw new Error("Class/club not found");
    }
    if (!(await canManageClub(club, userId))) {
        throw new Error("Only the club owner can delete this club");
    }
    if (await Contest.exists({ clubId: club.id })) {
        throw new Error("This club has contests. Delete or move those contests before deleting the club.");
    }

    await club.deleteOne();
}

export async function findUserManageableClubs(userId: Types.ObjectId): Promise<IClassClub[]> {
    const user = await User.findById(userId).select("admin").lean();
    if (user?.admin) {
        return ClassClub.find().sort({ name: 1 }).lean<IClassClub[]>();
    }

    return ClassClub.find({ ownerId: userId }).sort({ name: 1 }).lean<IClassClub[]>();
}

export async function getClubRole(club: IClassClub, userId?: Types.ObjectId): Promise<ClubRole> {
    if (!userId) {
        return "visitor";
    }

    const user = await User.findById(userId).select("admin email").lean();
    if (!user) {
        return "visitor";
    }
    if (user.admin) {
        return "admin";
    }
    if (club.ownerId?.toString() === userId.toString()) {
        return "owner";
    }
    if (club.memberEmails.includes(user.email)) {
        return "member";
    }
    if ((club.inviteEmails ?? []).includes(user.email)) {
        return "invited";
    }
    if ((club.requestEmails ?? []).includes(user.email)) {
        return "requested";
    }

    return "visitor";
}

export function normalizeClubId(id: string): string {
    return validator.escape(id.trim());
}

export function normalizeEmailList(input: string | string[] | undefined): string[] {
    const rawEmails = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\n,]/) : [];
    return [
        ...new Set(
            rawEmails
                .map((email) => validator.normalizeEmail(email.trim()))
                .filter((email): email is string => typeof email === "string" && validator.isEmail(email)),
        ),
    ];
}

export async function notifyClubOwnerOfJoinRequest(
    club: IClassClub,
    requesterEmail: string,
    sendMail = transporter.sendMail.bind(transporter),
): Promise<boolean> {
    try {
        if (!club.ownerId) {
            return false;
        }

        const owner = await User.findById(club.ownerId).select("email").lean();
        if (!owner?.email) {
            return false;
        }

        await sendMail({
            from: process.env.EMAIL_USER,
            subject: `${requesterEmail} requested to join ${club.name}`,
            text: `${requesterEmail} requested to join ${club.name} on Code Joint.\n\nOpen the club management page to approve or decline the request.`,
            to: owner.email,
        });
        return true;
    } catch (error) {
        console.warn("Failed to notify club owner about join request:", error);
        return false;
    }
}

export async function regenerateClubInviteCode(club: IClassClub): Promise<string> {
    const clubDocument = club as IClassClub & { _id?: Types.ObjectId };
    let inviteCode = createClubInviteCode();
    while (await ClassClub.exists({ _id: { $ne: clubDocument._id }, inviteCode })) {
        inviteCode = createClubInviteCode();
    }
    await ClassClub.updateOne({ _id: clubDocument._id }, { $set: { inviteCode } });
    club.inviteCode = inviteCode;
    return inviteCode;
}

export async function requestClubWithInviteCode(userId: Types.ObjectId, code: string): Promise<ClubJoinResult> {
    const inviteCode = normalizeClubInviteCode(code);
    if (!inviteCode) {
        throw new Error("Invite code is required");
    }

    const user = await User.findById(userId).select("email").lean();
    const club = await ClassClub.findOne({ inviteCode });
    if (!user || !club) {
        throw new Error("Invite code was not found");
    }

    if (club.ownerId?.toString() === userId.toString() || club.memberEmails.includes(user.email)) {
        return { club, requestCreated: false, requesterEmail: user.email, status: "already-member" };
    }

    if ((club.inviteEmails ?? []).includes(user.email)) {
        club.memberEmails = [...new Set([user.email, ...club.memberEmails])];
        club.inviteEmails = (club.inviteEmails ?? []).filter((email) => email !== user.email);
        club.requestEmails = (club.requestEmails ?? []).filter((email) => email !== user.email);
        await club.save();
        return { club, requestCreated: false, requesterEmail: user.email, status: "joined" };
    }

    if ((club.requestEmails ?? []).includes(user.email)) {
        return { club, requestCreated: false, requesterEmail: user.email, status: "already-requested" };
    }

    club.requestEmails = [...new Set([user.email, ...(club.requestEmails ?? [])])];
    club.inviteEmails = (club.inviteEmails ?? []).filter((email) => email !== user.email);
    await club.save();
    return { club, requestCreated: true, requesterEmail: user.email, status: "requested" };
}

export async function requireClubInviteCode(club: IClassClub): Promise<string> {
    if (club.inviteCode) {
        return club.inviteCode;
    }

    return regenerateClubInviteCode(club);
}

export function serializeClub(club: IClassClub, role: ClubRole): ClubView {
    const canManage = role === "admin" || role === "owner";
    const canViewRoster = canManage || role === "member";
    return {
        id: club.id,
        ...(canManage && club.inviteCode ? { inviteCode: club.inviteCode } : {}),
        inviteEmails: canManage ? (club.inviteEmails ?? []) : [],
        joinPolicy: "invite",
        memberEmails: canViewRoster ? club.memberEmails : [],
        name: club.name,
        ...(club.ownerId ? { ownerId: club.ownerId.toString() } : {}),
        requestEmails: canManage ? (club.requestEmails ?? []) : [],
        role,
    };
}
