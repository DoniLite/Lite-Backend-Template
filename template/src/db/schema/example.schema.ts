import { pgTable, text } from "drizzle-orm/pg-core";
import { BaseRow } from "./shared.schema";

/**
 * Example table - replace with your own entities
 */
export const ExampleTable = pgTable("examples", {
  ...BaseRow,
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
});

export type ExampleTableType = typeof ExampleTable.$inferSelect;
export type ExampleTableInsert = typeof ExampleTable.$inferInsert;
