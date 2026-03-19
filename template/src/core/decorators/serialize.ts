/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { SERIALIZE_METADATA } from "./constants";
import type { ClassConstructor } from "class-transformer";

export interface SerializeOptions {
  /** The DTO class to serialize the response to */
  dto: ClassConstructor<any>;
  /** Whether to serialize arrays (default: auto-detect) */
  isArray?: boolean;
}

/**
 * Get serialize metadata from a method
 */
export function getSerializeMetadata(
  target: any,
  propertyKey: string,
): SerializeOptions | undefined {
  return Reflect.getMetadata(SERIALIZE_METADATA, target, propertyKey);
}

/**
 * Serialize decorator - transforms the response using the specified DTO class
 * Uses class-transformer to exclude sensitive fields marked with @Exclude()
 *
 * @example
 * // Basic usage - excludes fields marked with @Exclude() in UserResponseDTO
 * @Serialize(UserResponseDTO)
 * @Get({ path: "/:id" })
 * async getById(c: Context) {
 *   return c.json(await this.service.findById(id));
 * }
 *
 * @example
 * // With arrays
 * @Serialize(UserResponseDTO, { isArray: true })
 * @Get({ path: "/" })
 * async list(c: Context) {
 *   return c.json(await this.service.findAll());
 * }
 */
export function Serialize(
  dto: ClassConstructor<any>,
  options?: Omit<SerializeOptions, "dto">,
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const serializeOptions: SerializeOptions = {
      dto,
      ...options,
    };

    Reflect.defineMetadata(
      SERIALIZE_METADATA,
      serializeOptions,
      target,
      propertyKey,
    );

    return descriptor;
  };
}
