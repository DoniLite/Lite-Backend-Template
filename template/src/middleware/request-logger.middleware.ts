import type { MiddlewareHandler } from "hono";
import { logger } from "@/core/logger";

export function requestLoggerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    logger.info(`${c.req.method} ${c.req.path}`, {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: `${duration}ms`,
    });
  };
}
