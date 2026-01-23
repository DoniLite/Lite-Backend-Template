/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { SWAGGER_METADATA } from "./constants";
import type { ClassConstructor } from "class-transformer";

export interface ApiResponseOptions {
  description: string;
  schema?: ClassConstructor<any>;
}

export function getSwaggerMetadata(
  target: any,
  propertyKey: string,
): Record<number, ApiResponseOptions> | undefined {
  return Reflect.getMetadata(SWAGGER_METADATA, target, propertyKey);
}

/**
 * ApiResponse decorator - documents API response for Swagger
 * @example
 * @ApiResponse(200, { description: "Success", schema: UserDTO })
 * @ApiResponse(404, { description: "Not found" })
 * @Get({ path: "/:id" })
 * async getById(c: Context) {}
 */
export function ApiResponse(statusCode: number, options: ApiResponseOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const existing =
      Reflect.getMetadata(SWAGGER_METADATA, target, propertyKey) || {};
    existing[statusCode] = options;
    Reflect.defineMetadata(SWAGGER_METADATA, existing, target, propertyKey);
    return descriptor;
  };
}
