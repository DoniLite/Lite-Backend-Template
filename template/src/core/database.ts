import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schemas from "@/db";
import type { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { Logger } from "./logger";
import { appConfig } from "./config/app.config";

class CustomDrizzleLogger implements DrizzleLogger {
  logQuery(query: string, params: unknown[]): void {
    Logger.getInstance().debug("SQL Query", {
      query,
      params: JSON.stringify(params),
    });
  }
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db;

  private constructor() {
    const pool = new Pool({
      connectionString: appConfig.database.url,
    });
    this.db = drizzle(pool, {
      schema: {
        ...schemas,
      },
      logger: new CustomDrizzleLogger(),
    });
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  getDatabase() {
    return this.db;
  }
}
