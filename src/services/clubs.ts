import { Types } from "mongoose";
import validator from "validator";

import { ClassClub, Contest, User } from "../models";
import { IClassClub } from "../types/models";

export type ClubRole = "admin" | "invited" | "member" | "owner" | "requested" | "visitor";

export interface ClubView {
    id: string;
    inviteEmails: string[];
    joinPolicy: "invite" | "open";
    memberEmails: string[];
    name: string;
    ownerId?: string;
    requestEmails: string[];
    role: ClubRole;
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

export function serializeClub(club: IClassClub, role: ClubRole): ClubView {
    return {
        id: club.id,
        inviteEmails: club.inviteEmails ?? [],
        joinPolicy: club.joinPolicy ?? "invite",
        memberEmails: club.memberEmails,
        name: club.name,
        ...(club.ownerId ? { ownerId: club.ownerId.toString() } : {}),
        requestEmails: club.requestEmails ?? [],
        role,
    };
}
