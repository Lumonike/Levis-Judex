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

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import validator from "validator";

import { User } from "../models";

interface TestUserOptions {
    admin: boolean;
    email: string;
    password: string;
    update: boolean;
}

const usage = [
    "Usage:",
    "  npm run create:test-user -- <email> <password> [--admin] [--update]",
    "",
    "Examples:",
    "  npm run create:test-user -- student@example.com password123",
    "  npm run create:test-user -- admin@example.com password123 --admin",
    "  npm run create:test-user -- student@example.com newpass123 --update",
].join("\n");

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed to create test user.");
    process.exit(1);
});

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const passwordHash = await bcrypt.hash(options.password, 10);
    await mongoose.connect(process.env.MONGODB_URI ?? process.env.MONGO_URI ?? "mongodb://localhost:27017/authdb");

    try {
        const existingUser = await User.findOne({ email: options.email });
        if (existingUser && !options.update) {
            throw new Error(`User ${options.email} already exists. Rerun with --update to change the password/admin status.`);
        }

        const user = await User.findOneAndUpdate(
            { email: options.email },
            {
                $set: {
                    admin: options.admin,
                    email: options.email,
                    password: passwordHash,
                    verified: true,
                },
                $unset: {
                    verificationToken: "",
                    verificationTokenExpiresAt: "",
                },
            },
            { new: true, setDefaultsOnInsert: true, upsert: true },
        );

        console.log(`${existingUser ? "Updated" : "Created"} verified test user ${user.email} (${user._id.toString()})`);
        console.log(`Admin: ${user.admin ? "yes" : "no"}`);
    } finally {
        await mongoose.disconnect();
    }
}

function parseArgs(args: string[]): TestUserOptions {
    const flags = new Set(args.filter((arg) => arg.startsWith("--")));
    const values = args.filter((arg) => !arg.startsWith("--"));

    if (flags.has("--help") || flags.has("-h")) {
        console.log(usage);
        process.exit(0);
    }

    const unknownFlags = [...flags].filter((flag) => !["--admin", "--help", "--update", "-h"].includes(flag));
    if (unknownFlags.length > 0) {
        throw new Error(`Unknown option ${unknownFlags.join(", ")}\n\n${usage}`);
    }

    const [rawEmail, password] = values;
    if (!rawEmail || !password || values.length !== 2) {
        throw new Error(`Email and password are required.\n\n${usage}`);
    }

    const email = validator.normalizeEmail(rawEmail.trim());
    if (!email || !validator.isEmail(email)) {
        throw new Error("Invalid email address.");
    }

    if (password.length > 128) {
        throw new Error("Password must be less than 128 characters.");
    }

    return {
        admin: flags.has("--admin"),
        email,
        password,
        update: flags.has("--update"),
    };
}
