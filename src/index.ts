import mongoose from "mongoose";

import { createApp } from "./app";
import { migrateDatabase } from "./services/database-migration";
import { resumePendingSubmissions } from "./services/submissions";

const port = process.env.PORT ?? "3000";

async function main(): Promise<void> {
    await mongoose.connect(process.env.MONGO_URI ?? "mongodb://localhost:27017/authdb");
    console.log("✅ MongoDB Connected");

    const migration = await migrateDatabase();
    const migratedItems = migration.problems.testcasesMigrated + migration.contests.migrated + migration.submissions.migrated;
    if (migratedItems > 0) {
        console.log(`Database migration complete: ${JSON.stringify(migration)}`);
    }

    await resumePendingSubmissions();

    const app = createApp();
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

void main().catch((err: unknown) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
