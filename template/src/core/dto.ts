/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IsDate,
  IsOptional,
  IsString,
  IsBoolean,
  validate,
  type ValidatorOptions,
  getMetadataStorage,
  IsNumber,
  ValidateNested,
  IsObject,
} from "class-validator";
import {
  plainToInstance,
  Type,
  Expose,
  type ClassConstructor,
  type ClassTransformOptions,
} from "class-transformer";
import type { PaginatedResponse, SortOrder } from "@/types/pagination";
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { DTO } from "./decorators";

export function PartialDTO<T extends ClassConstructor<object>>(DTOClass: T): T {
  @DTO()
  class PartialClass extends DTOClass {}

  const metadatas = getMetadataStorage().getTargetValidationMetadatas(
    DTOClass,
    "",
    false,
    false,
  );

  const uniqueProperties = [...new Set(metadatas.map((m) => m.propertyName))];

  uniqueProperties.forEach((key) => {
    IsOptional()(PartialClass.prototype, key);
  });

  Object.defineProperty(PartialClass, "name", {
    value: `Partial${DTOClass.name}`,
  });

  return PartialClass as T;
}

export abstract class BaseDTO {
  /**
   * Create an instance of the DTO from a plain object.
   */
  static from<T extends BaseDTO>(
    this: new () => T,
    plain: any,
    options?: ClassTransformOptions,
  ): T {
    return plainToInstance(this, plain, options);
  }

  /**
   * Create an instance with ONLY properties decorated with @Expose().
   */
  static fromStrict<T extends BaseDTO>(
    this: new () => T,
    plain: any,
    options?: Omit<ClassTransformOptions, "excludeExtraneousValues">,
  ): T {
    return plainToInstance(this, plain, {
      ...options,
      excludeExtraneousValues: true,
    });
  }

  /**
   * Validate the current DTO instance
   */
  async validate(options?: ValidatorOptions) {
    return validate(this, options);
  }
}

export function PaginatedResponseDTO<T>(
  ItemClass: ClassConstructor<T>,
): ClassConstructor<PaginatedResponse<T>> {
  @DTO()
  class PaginatedResponseClass extends BaseDTO {
    @Expose()
    @ValidateNested({ each: true })
    @Type(() => ItemClass)
    items!: T[];

    @Expose()
    @IsNumber()
    itemCount!: number;

    @Expose()
    @IsNumber()
    page!: number;

    @Expose()
    @IsNumber()
    pageSize!: number;

    @Expose()
    @IsNumber()
    pageCount!: number;
  }

  Object.defineProperty(PaginatedResponseClass, "name", {
    value: `Paginated${ItemClass.name}Response`,
  });

  return PaginatedResponseClass;
}

@DTO()
export class PaginationQuerysDTO extends BaseDTO {
  @Expose()
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Expose()
  @IsNumber()
  @IsOptional()
  pageSize: number = 10;

  @Expose()
  @IsString()
  @IsOptional()
  search?: string;

  @Expose()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @Expose()
  @IsString()
  @IsOptional()
  sortOrder?: SortOrder;

  @Expose()
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean = false;

  @Expose()
  @IsBoolean()
  @IsOptional()
  populateChildren?: boolean = false;

  @Expose()
  @IsObject()
  @IsOptional()
  filters?: Record<string, string | number | boolean | string[] | undefined> =
    {};
}

export interface CreateBaseOptions {
  exclude?: string[];
}

export function CreateBase<T extends PgTable>(
  table: T,
  options: CreateBaseOptions = {},
) {
  const tableName = (table as any)[Symbol.for("drizzle:Name")] || "BaseClass";

  const excludeSuffix =
    options.exclude && options.exclude.length > 0
      ? `_excluded_${options.exclude.sort().join("_")}`
      : "";

  const uniqueClassName = `${tableName}Base${excludeSuffix}`;

  @DTO()
  class BaseClass extends BaseDTO {}

  Object.defineProperty(BaseClass, "name", {
    value: uniqueClassName,
  });

  const columns = getTableColumns(table);

  for (const [key, column] of Object.entries(columns)) {
    if (options.exclude?.includes(key)) {
      continue;
    }

    const col = column as any;
    const isRequired = col.notNull && !col.hasDefault;
    const type = col.getSQLType();

    if (
      type.includes("text") ||
      type.includes("char") ||
      type.includes("uuid") ||
      type.includes("varchar")
    ) {
      IsString()(BaseClass.prototype, key);
    } else if (
      type.includes("int") ||
      type.includes("serial") ||
      type.includes("double") ||
      type.includes("real") ||
      type.includes("numeric")
    ) {
      IsNumber()(BaseClass.prototype, key);
    } else if (type.includes("boolean")) {
      IsBoolean()(BaseClass.prototype, key);
    } else if (type.includes("timestamp") || type.includes("date")) {
      IsDate()(BaseClass.prototype, key);
      Type(() => Date)(BaseClass.prototype, key);
    } else {
      IsString()(BaseClass.prototype, key);
    }

    Expose()(BaseClass.prototype, key);

    if (!isRequired) {
      IsOptional()(BaseClass.prototype, key);
    }
  }

  return BaseClass;
}

@DTO()
export class BaseErrorDTO {
  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

@DTO()
export class BaseDeletedSuccessDTO {
  @IsBoolean()
  deleted!: boolean;

  @IsString()
  id!: string;
}

@DTO()
export class BaseDeleteMultipleSuccessDTO {
  @IsBoolean()
  deleted!: boolean;

  @IsNumber()
  deletedCount!: number;

  @IsNumber()
  requestedCount!: number;

  @IsOptional()
  @IsString()
  message?: string;
}
