import crypto from "node:crypto";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;

export function createClubInviteCode(): string {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        code += INVITE_CODE_ALPHABET[crypto.randomInt(INVITE_CODE_ALPHABET.length)];
    }
    return code;
}

export function normalizeClubInviteCode(code: string): string {
    return code
        .trim()
        .toUpperCase()
        .replaceAll(/[^A-Z0-9]/g, "");
}
