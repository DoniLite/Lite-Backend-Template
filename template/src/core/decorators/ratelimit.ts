/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { RATE_LIMIT_METADATA } from "./constants";
import type { RateLimitOptions } from "./interfaces";

export function getRateLimitMetadata(
  target: any,
  propertyKey: string,
): RateLimitOptions | undefined {
  return Reflect.getMetadata(RATE_LIMIT_METADATA, target, propertyKey);
}

/**
 * RateLimit decorator - applies rate limiting to route
 * @example
 * @RateLimit({ max: 10, window: 60 })
 * @Post({ path: "/login" })
 * async login(c: Context) {}
 */
export function RateLimit(options: RateLimitOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_METADATA, options, target, propertyKey);
    return descriptor;
  };
}
