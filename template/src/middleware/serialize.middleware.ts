/* eslint-disable @typescript-eslint/no-explicit-any */
import { plainToInstance, instanceToPlain } from "class-transformer";
import type { ClassConstructor } from "class-transformer";

export interface SerializeConfig {
  /** The DTO class to serialize to */
  dto: ClassConstructor<any>;
  /** Whether the data is an array */
  isArray?: boolean;
  /** Exclude extraneous values not defined in the DTO */
  excludeExtraneousValues?: boolean;
}

/**
 * Serialize data using class-transformer
 * Handles objects, arrays, and nested structures
 *
 * @param data - The data to serialize (plain object, array, or already an instance)
 * @param config - Serialization configuration
 * @returns Serialized plain object with excluded fields removed
 */
export function serialize<T>(
  data: any,
  config: SerializeConfig,
): T | T[] | null {
  if (data === null || data === undefined) {
    return null;
  }

  const { dto, isArray, excludeExtraneousValues = true } = config;

  // Handle arrays
  if (Array.isArray(data) || isArray) {
    const items = Array.isArray(data) ? data : [data];
    return items.map((item) =>
      serializeSingle(item, dto, excludeExtraneousValues),
    ) as T[];
  }

  // Handle paginated responses (has 'items' array)
  // Check if the DTO itself is a Paginated wrapper
  const isPaginatedWrapper = (dto as any).name?.startsWith("Paginated");

  if (
    !isPaginatedWrapper &&
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray(data.items)
  ) {
    return {
      ...data,
      items: data.items.map((item: any) =>
        serializeSingle(item, dto, excludeExtraneousValues),
      ),
    } as T;
  }

  // Handle single object
  return serializeSingle(data, dto, excludeExtraneousValues) as T;
}

/**
 * Serialize a single object
 */
function serializeSingle<T>(
  data: any,
  dto: ClassConstructor<T>,
  excludeExtraneousValues: boolean,
): T {
  // Convert plain object to class instance
  const instance = plainToInstance(dto, data, {
    excludeExtraneousValues,
  });

  // Convert back to plain object, respecting @Exclude() decorators
  return instanceToPlain(instance, {
    excludePrefixes: ["_"],
  }) as T;
}

/**
 * Create a serialization wrapper for response data
 * Useful for manual serialization in controllers
 *
 * @example
 * const serializer = createSerializer(UserResponseDTO);
 * return c.json(serializer(userData));
 */
export function createSerializer<T>(
  dto: ClassConstructor<T>,
  options?: Omit<SerializeConfig, "dto">,
) {
  return (data: any): T | T[] | null => {
    return serialize(data, { dto, ...options });
  };
}
