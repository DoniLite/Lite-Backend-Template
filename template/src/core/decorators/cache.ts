/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { CACHE_METADATA } from "./constants";
import type { CacheOptions } from "./interfaces";

export function getCacheMetadata(
  target: any,
  propertyKey: string,
): CacheOptions | undefined {
  return Reflect.getMetadata(CACHE_METADATA, target, propertyKey);
}

/**
 * Cache decorator - caches response for specified TTL
 * @example
 * @Cache({ ttl: 300, key: "users-list" })
 * @Get({ path: "/" })
 * async list(c: Context) {}
 */
export function Cache(options: CacheOptions = {}) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CACHE_METADATA, options, target, propertyKey);
    return descriptor;
  };
}
