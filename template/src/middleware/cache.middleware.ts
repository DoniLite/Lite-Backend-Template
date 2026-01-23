import type { MiddlewareHandler } from "hono";
import type { CacheOptions } from "@/core/decorators/interfaces";
import { appConfig } from "@/core/config/app.config";

const cache = new Map<string, { data: unknown; expiry: number }>();

export function cacheMiddleware(options: CacheOptions = {}): MiddlewareHandler {
  const ttl = options.ttl || appConfig.cache.ttl;

  return async (c, next) => {
    if (!appConfig.cache.enabled) {
      await next();
      return;
    }

    const cacheKey = options.key || `${c.req.method}:${c.req.url}`;
    const cached = cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      c.header("X-Cache", "HIT");
      return c.json(cached.data);
    }

    await next();

    if (c.res.status === 200) {
      const clonedResponse = c.res.clone();
      const data = await clonedResponse.json();
      cache.set(cacheKey, {
        data,
        expiry: Date.now() + ttl * 1000,
      });
      c.header("X-Cache", "MISS");
    }
  };
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}
