import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { appConfig } from "./config/app.config";
import { logger } from "./logger";

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: ReturnType<typeof drizzle>;

  private constructor() {
    const pool = new Pool({
      connectionString: appConfig.database.url,
      max: appConfig.database.poolSize,
    });

    this.db = drizzle(pool);
    logger.info("Database connection established");
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getDatabase() {
    return this.db;
  }
}
