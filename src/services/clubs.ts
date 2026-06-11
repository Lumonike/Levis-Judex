import { Types } from "mongoose";
import validator from "validator";

import { createClubInviteCode, normalizeClubInviteCode } from "../lib/invite-codes";
import { MAX_CLUBS_PER_OWNER } from "../lib/limits";
import { ClassClub, Contest, User } from "../models";
import { IClassClub } from "../types/models";

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

export async function requestClubWithInviteCode(userId: Types.ObjectId, code: string): Promise<IClassClub> {
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
        return club;
    }

    club.requestEmails = [...new Set([user.email, ...(club.requestEmails ?? [])])];
    club.inviteEmails = (club.inviteEmails ?? []).filter((email) => email !== user.email);
    await club.save();
    return club;
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
