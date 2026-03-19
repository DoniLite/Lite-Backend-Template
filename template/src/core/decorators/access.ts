import type { Context, Next } from "hono";
import { canAccess, type UserRoles } from "@/helpers/access.helper";
import { MIDDLEWARE_METADATA } from "./constants";

export function Can(allowedRoles: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const middleware = async (c: Context, next: Next) => {
      const payload = c.get("jwtPayload");
      if (!payload) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!canAccess(payload.role as UserRoles, allowedRoles)) {
        return c.json({ error: "Access denied" }, 403);
      }
      return await next();
    };

    // Prepend to ensure @Can runs AFTER auth middleware
    // (decorators execute bottom-to-top, but we want Can to always be last)
    const middlewares =
      Reflect.getMetadata(MIDDLEWARE_METADATA, target, propertyKey) || [];
    Reflect.defineMetadata(
      MIDDLEWARE_METADATA,
      [middleware, ...middlewares],
      target,
      propertyKey,
    );
    return descriptor;
  };
}
