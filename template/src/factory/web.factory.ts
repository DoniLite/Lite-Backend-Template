import { createFactory } from "hono/factory";
import type { JwtVariables } from "hono/jwt";

export type Variables = {
  // Add custom context variables here
} & JwtVariables;

export const webFactory = createFactory<{
  Variables: Variables;
}>();
