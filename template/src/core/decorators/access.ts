/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { ACCESS_METADATA } from "./constants";

export function getAccessMetadata(
  target: any,
  propertyKey: string,
): string | undefined {
  return Reflect.getMetadata(ACCESS_METADATA, target, propertyKey);
}

/**
 * Can decorator - defines required access level for a route
 * @example
 * @Can("admin:write")
 * @Post({ path: "/" })
 * async create(c: Context) {}
 */
export function Can(access: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(ACCESS_METADATA, access, target, propertyKey);
    return descriptor;
  };
}
