/* eslint-disable @typescript-eslint/no-explicit-any */
import { plainToInstance, instanceToPlain } from "class-transformer";
import type { ClassConstructor } from "class-transformer";
import type { SerializeOptions } from "@/core/decorators/interfaces";

export interface SerializeResult<T> {
  success: boolean;
  data?: T;
  items?: T[];
  itemCount?: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
}

export function serialize<T>(
  data: any,
  options: SerializeOptions,
): SerializeResult<T> {
  const { dto, isArray } = options;

  try {
    if (data?.items && Array.isArray(data.items)) {
      // Paginated response
      const serializedItems = data.items.map((item: any) =>
        serializeOne(item, dto),
      );
      return {
        success: true,
        items: serializedItems,
        itemCount: data.itemCount,
        page: data.page,
        pageSize: data.pageSize,
        pageCount: data.pageCount,
      };
    }

    if (isArray && Array.isArray(data)) {
      const serializedItems = data.map((item: any) => serializeOne(item, dto));
      return {
        success: true,
        items: serializedItems,
      };
    }

    if (data?.data) {
      return {
        success: true,
        data: serializeOne(data.data, dto),
      };
    }

    return {
      success: true,
      data: serializeOne(data, dto),
    };
  } catch (error) {
    console.error("Serialization error:", error);
    return { success: false };
  }
}

function serializeOne<T>(data: any, dto: ClassConstructor<T>): T {
  const instance = plainToInstance(dto, data, {
    excludeExtraneousValues: true,
  });
  return instanceToPlain(instance) as T;
}
