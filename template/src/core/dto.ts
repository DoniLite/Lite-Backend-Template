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
  IsArray, // Added IsObject
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
import { DTO, DTO_CLASSES } from "./decorators";
import { JSONSchema } from "class-validator-jsonschema"; // Added JSONSchema import

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

  // Copy metadata name to keep things clean/identifiable if needed
  Object.defineProperty(PartialClass, "name", {
    value: `Partial${DTOClass.name}`,
  });

  DTO_CLASSES.set(PartialClass.name, PartialClass);

  return PartialClass as T;
}

export abstract class BaseDTO {
  /**
   * Create an instance of the DTO from a plain object.
   * By default, copies all properties from the source object.
   * Use `fromStrict()` to only include properties decorated with @Expose().
   *
   * @param plain - Source object to transform
   * @param options - Optional class-transformer options
   */
  static from<T extends BaseDTO>(
    this: new () => T,
    plain: any,
    options?: ClassTransformOptions,
  ): T {
    return plainToInstance(this, plain, options);
  }

  /**
   * Create an instance of the DTO with ONLY the properties decorated with @Expose().
   * Properties not marked with @Expose() will be excluded from the result.
   *
   * @param plain - Source object to transform
   * @param options - Additional class-transformer options
   *
   * @example
   * // Only includes id, email, name, image, token (decorated with @Expose)
   * UserSessionDTO.fromStrict({ ...user, password: 'secret', token })
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
  page?: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  pageSize?: number;

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
  includeDeleted?: boolean;

  @Expose()
  @IsBoolean()
  @IsOptional()
  populateChildren?: boolean;

  @Expose()
  @IsObject()
  @IsOptional()
  filters?: Record<string, string | number | boolean | string[] | undefined>;
}

export interface CreateBaseOptions {
  exclude?: string[];
}

export function CreateBase<T extends PgTable>(
  table: T,
  options: CreateBaseOptions = {},
) {
  const tableName = (table as any)[Symbol.for("drizzle:Name")] || "BaseClass";

  // Create unique name based on excluded fields to avoid conflicts
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

  console.debug(
    `Creating ${uniqueClassName} with columns:`,
    Object.keys(columns).filter((key) => !options.exclude?.includes(key)),
  );

  for (const [key, column] of Object.entries(columns)) {
    // Skip excluded fields
    if (options.exclude?.includes(key)) {
      console.debug(`Excluding field: ${key} from ${uniqueClassName}`);
      continue;
    }

    const col = column as any; // Cast to any to access internal properties safely for now
    const isRequired = col.notNull && !col.hasDefault;
    const type = col.getSQLType();

    // Add validation decorators based on type
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
    } else if (type.startsWith("timestamp") || type === "date") {
      IsDate()(BaseClass.prototype, key);
      Type(() => Date)(BaseClass.prototype, key);
    } else {
      // Fallback to string for unknown types (like enums if not caught elsewhere)
      IsString()(BaseClass.prototype, key);
    }

    // Add @Expose() to include this field in serialization (whitelist approach)
    Expose()(BaseClass.prototype, key);

    // Handle optional fields
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
  @JSONSchema({
    type: "object",
    description: "Additional error details",
    additionalProperties: true,
  })
  details?: Record<string, any>;
}

@DTO()
export class BaseDeletedSuccessDTO extends BaseDTO {
  @Expose()
  @IsBoolean()
  deleted!: boolean;

  @Expose()
  @IsString()
  id!: string;
}

@DTO()
export class DeleteMultipleDTO {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

@DTO()
export class BaseDeleteMultipleSuccessDTO {
  @Expose()
  @IsBoolean()
  deleted!: boolean;

  @Expose()
  @IsNumber()
  deletedCount!: number;

  @Expose()
  @IsNumber()
  requestedCount!: number;

  @Expose()
  @IsOptional()
  @IsString()
  message?: string;
}

@DTO()
export class StatisticsPeriodDTO extends BaseDTO {
  @Expose()
  @IsNumber()
  count!: number;

  @Expose()
  @IsString()
  period!: string;

  @Expose()
  @IsNumber()
  @IsOptional()
  percentage?: number;
}

@DTO()
export class StatisticsComparisonDTO extends BaseDTO {
  @Expose()
  @ValidateNested()
  @Type(() => StatisticsPeriodDTO)
  current!: StatisticsPeriodDTO;

  @Expose()
  @ValidateNested()
  @Type(() => StatisticsPeriodDTO)
  previous!: StatisticsPeriodDTO;

  @Expose()
  @IsNumber()
  growth!: number;

  @Expose()
  @IsNumber()
  growthPercentage!: number;
}

@DTO()
export class EntityStatisticsDTO extends BaseDTO {
  @Expose()
  @ValidateNested()
  @Type(() => StatisticsComparisonDTO)
  monthly!: StatisticsComparisonDTO;

  @Expose()
  @ValidateNested()
  @Type(() => StatisticsComparisonDTO)
  weekly!: StatisticsComparisonDTO;

  @Expose()
  @ValidateNested()
  @Type(() => StatisticsComparisonDTO)
  yearly!: StatisticsComparisonDTO;
}
