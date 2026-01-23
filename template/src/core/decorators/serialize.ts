/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { SERIALIZE_METADATA } from "./constants";
import type { SerializeOptions } from "./interfaces";
import type { ClassConstructor } from "class-transformer";

export function getSerializeMetadata(
  target: any,
  propertyKey: string,
): SerializeOptions | undefined {
  return Reflect.getMetadata(SERIALIZE_METADATA, target, propertyKey);
}

/**
 * Serialize decorator - transforms response data through DTO
 * @example
 * @Serialize(UserDTO)
 * @Get({ path: "/:id" })
 * async getById(c: Context) {}
 */
export function Serialize(
  dto: ClassConstructor<any>,
  options: { isArray?: boolean } = {},
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const serializeOptions: SerializeOptions = {
      dto,
      isArray: options.isArray,
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
