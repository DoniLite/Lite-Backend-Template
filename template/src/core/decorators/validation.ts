/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { type ClassConstructor, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { bodyGetter, ContextInstance } from "../types/base";
import { DTO_CLASSES } from "./registries";

// ===== ERROR CLASSES =====
export class ValidationError extends Error {
  constructor(
    public statusCode: ContentfulStatusCode,
    public errors: Array<{ property: string; constraints: any; value: any }>,
  ) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

// ===== VALIDATION DECORATOR =====

/**
 * ValidateDTO decorator - validates request body against DTO class
 * @example
 * @ValidateDTO(CreateUserDTO, "json")
 * async create(dto: CreateUserDTO, context: Context) {}
 */
export function ValidateDTO<T extends object, B extends bodyGetter>(
  dtoClassName?: new (...args: any[]) => T,
  provider: B = "json" as B,
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const c: Context | undefined = args.find(
        (arg) =>
          arg &&
          typeof arg === "object" &&
          "req" in arg &&
          typeof (arg as any).json === "function",
      );

      if (!c) {
        throw new Error(
          `The method ${propertyKey} decorated with @ValidateDTO must receive the Hono context (c) as an argument.`,
        );
      }

      const rawBody = (await c.req[provider]()) as ContextInstance<B>;
      let body: Record<string, unknown> = {};

      let dtoClass: new (...args: any[]) => T;
      if (provider === "json") {
        body = rawBody as Record<string, unknown>;
      } else if (provider === "formData") {
        body = Object.fromEntries((rawBody as FormData).entries());
      } else if (provider === "query") {
        body = rawBody as Record<string, unknown>;
      }

      if (dtoClassName) {
        dtoClass = DTO_CLASSES.get(dtoClassName.name);
        if (!dtoClass) {
          throw new Error(`DTO class "${dtoClassName}" not found in registry`);
        }
      } else {
        const paramTypes = Reflect.getMetadata(
          "design:paramtypes",
          target,
          propertyKey,
        );
        dtoClass = paramTypes?.find((param: any) =>
          DTO_CLASSES.has(param.name),
        );

        if (!dtoClass) {
          throw new Error(
            `No DTO class found for ${target.constructor.name}.${propertyKey}`,
          );
        }
      }

      const dtoInstance = plainToInstance(dtoClass, body);
      const errors = await validate(dtoInstance);

      if (errors.length > 0) {
        throw new ValidationError(
          400,
          errors.map((err) => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          })),
        );
      }

      const paramTypes = Reflect.getMetadata(
        "design:paramtypes",
        target,
        propertyKey,
      );
      const dtoParamIndex =
        paramTypes?.findIndex(
          (param: ClassConstructor<unknown>) =>
            param === dtoClass || DTO_CLASSES.has(param.name),
        ) ?? 0;

      args[dtoParamIndex] = dtoInstance;

      return originalMethod.apply(this, args);
    };
  };
}
