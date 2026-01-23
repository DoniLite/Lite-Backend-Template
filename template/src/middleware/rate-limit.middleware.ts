import type { MiddlewareHandler } from "hono";
import type { RateLimitOptions } from "@/core/decorators/interfaces";
import { appConfig } from "@/core/config/app.config";
import { ResponseHelper } from "@/helpers/response.helper";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  const max = options.max || appConfig.rateLimit.max;
  const window = options.window || appConfig.rateLimit.window;

  return async (c, next) => {
    if (!appConfig.rateLimit.enabled) {
      await next();
      return;
    }

    const ip =
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + window * 1000,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    c.header("X-RateLimit-Limit", max.toString());
    c.header(
      "X-RateLimit-Remaining",
      Math.max(0, max - entry.count).toString(),
    );
    c.header("X-RateLimit-Reset", entry.resetTime.toString());

    if (entry.count > max) {
      return c.json(
        ResponseHelper.error("Too many requests, please try again later"),
        429,
      );
    }

    await next();
  };
}
