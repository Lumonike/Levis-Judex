import { runDatabaseMigrationFromEnv } from "../services/database-migration";

void runDatabaseMigrationFromEnv()
    .then((result) => {
        console.log(JSON.stringify(result, null, 2));
    })
    .catch((err: unknown) => {
        console.error("Database migration failed:", err);
        process.exit(1);
    });
