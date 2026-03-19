/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context, Next } from "hono";

/**
 * Cache middleware for caching route responses
 */
export interface CacheStore {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

class MemoryCacheStore implements CacheStore {
  private cache = new Map<string, { value: any; expiry: number }>();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

export const defaultCacheStore = new MemoryCacheStore();

export function cacheMiddleware(
  options: { ttl?: number; keyGenerator?: (c: any) => string } = {},
) {
  return async (c: Context, next: Next) => {
    const { ttl = 300, keyGenerator } = options;

    // Only cache GET requests
    if (c.req.method !== "GET") {
      return next();
    }

    const cacheKey = keyGenerator
      ? keyGenerator(c)
      : `${c.req.method}:${c.req.path}:${JSON.stringify(c.req.query())}`;

    // Try to get from cache
    const cached = await defaultCacheStore.get(cacheKey);
    if (cached) {
      return c.json(cached);
    }

    // Continue to handler
    await next();

    // Cache the response
    if (c.res.status === 200) {
      try {
        const body = await c.res.clone().json();
        await defaultCacheStore.set(cacheKey, body, ttl);
      } catch (e) {
        // Response might not be JSON, skip caching
        console.error("Failed to cache response:", e);
      }
    }
  };
}
