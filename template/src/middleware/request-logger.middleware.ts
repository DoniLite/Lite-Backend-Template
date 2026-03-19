/**
 * Request logging middleware
 */
import { logger } from "../core/logger";
import type { Context, Next } from "hono";

export function requestLoggerMiddleware() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    logger.info(`→ ${method} ${path}`, {
      method,
      path,
      userAgent: c.req.header("user-agent"),
    });

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info(`← ${method} ${path} ${status} (${duration}ms)`, {
      method,
      path,
      status,
      duration,
    });
  };
}
