import type { ExampleTable } from "./example.schema";

// Export all table types here
export type ExampleTableType = typeof ExampleTable.$inferSelect;
