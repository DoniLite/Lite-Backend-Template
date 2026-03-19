import type { Context, Next } from "hono";

/**
 * Rate limiting middleware
 */
interface RateLimitStore {
  increment(key: string, window: number): Promise<number>;
  reset(key: string): Promise<void>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, window: number): Promise<number> {
    const now = Date.now();
    const item = this.store.get(key);

    if (!item || now > item.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + window * 1000,
      });
      return 1;
    }

    item.count++;
    return item.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export const defaultRateLimitStore = new MemoryRateLimitStore();

export function rateLimitMiddleware(options: {
  max: number;
  window: number;
  message?: string;
}) {
  return async (c: Context, next: Next) => {
    const { max, window, message = "Too many requests" } = options;

    // Generate key based on IP or user ID
    const identifier =
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip") ||
      "anonymous";
    const key = `rate-limit:${identifier}:${c.req.path}`;

    const count = await defaultRateLimitStore.increment(key, window);

    // Set rate limit headers
    c.header("X-RateLimit-Limit", max.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, max - count).toString());
    c.header("X-RateLimit-Reset", (Date.now() + window * 1000).toString());

    if (count > max) {
      return c.json(
        {
          error: message,
          retryAfter: window,
        },
        429,
      );
    }

    return next();
  };
}
