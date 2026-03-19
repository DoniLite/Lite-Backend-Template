/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import type {
  PgInsertValue,
  PgTable,
  PgTableWithColumns,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core";
import { DatabaseConnection } from "./database";
import type { BaseEntity, BaseTable, CrudOperations } from "./types/base";
import type {
  PaginatedResponse,
  PaginationQuery,
  SortOrder,
} from "@/types/pagination";
import { logger } from "./logger";

export interface StatisticsPeriod {
  count: number;
  period: string;
  percentage?: number;
}

export interface StatisticsComparison {
  current: StatisticsPeriod;
  previous: StatisticsPeriod;
  growth: number;
  growthPercentage: number;
}

export interface EntityStatistics {
  monthly: StatisticsComparison;
  weekly: StatisticsComparison;
  yearly: StatisticsComparison;
}

export abstract class BaseRepository<
  T extends BaseEntity = BaseEntity,
  Tb extends PgTableWithColumns<BaseTable> = PgTableWithColumns<BaseTable>,
  CreateDTO extends PgInsertValue<Tb> = PgInsertValue<Tb>,
  UpdateDTO extends PgUpdateSetSource<Tb> = PgUpdateSetSource<Tb>,
  R extends T = T,
> implements CrudOperations<T, CreateDTO, UpdateDTO> {
  protected db = DatabaseConnection.getInstance().getDatabase();
  protected abstract table: Tb;
  protected logger = logger;
  protected populateChildren = false;

  async create(dto: CreateDTO): Promise<R> {
    this.logger.debug("Creating entity in DB", {
      table: (this.table as any)[Symbol.for("drizzle:Name")] || "unknown",
    });
    const [result] = await this.db.insert(this.table).values(dto).returning();
    const entity = result as unknown as T;

    if (this.populateChildren) {
      const populated = await this.populateChildrenForItems([entity]);
      return (populated[0] as R) || (entity as unknown as R);
    }

    return entity as unknown as R;
  }

  async findById(id: string | number): Promise<R | null> {
    const [result] = await this.db
      .select()
      .from(this.table as PgTable)
      .where(eq(this.table.id, id))
      .limit(1);

    if (!result) return null;

    const entity = result as T;
    if (this.populateChildren) {
      const populated = await this.populateChildrenForItems([entity]);
      return (populated[0] as R) || (entity as unknown as R);
    }

    return entity as unknown as R;
  }

  async findPaginated(
    paginationQuery: PaginationQuery,
  ): Promise<PaginatedResponse<R>> {
    const {
      page = 1,
      pageSize = 10,
      search,
      sortBy = "id",
      sortOrder = "asc" as SortOrder,
      populateChildren = false,
      filters = {},
    } = paginationQuery;

    // Validate pagination params
    const validPage = Math.max(1, page);
    const validPageSize = Math.max(1, pageSize);
    const offset = (validPage - 1) * validPageSize;

    let query = this.db.select().from(this.table as PgTable);
    const conditions: any[] = [];

    // Apply filters
    if (Object.keys(filters).length > 0) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            // Handle array filters (IN clause)
            conditions.push(eq((this.table as any)[key], value[0]));
          } else if (typeof value === "string" || typeof value === "number") {
            conditions.push(eq((this.table as any)[key], value));
          } else if (typeof value === "boolean") {
            conditions.push(eq((this.table as any)[key], value));
          }
        }
      }
    }

    // Apply search if provided
    if (search?.trim()) {
      const searchTerms = search.trim().split(" ").filter(Boolean);
      const searchConditions = searchTerms.flatMap((term) => {
        // Search across common text fields
        const textFields = [
          "name",
          "title",
          "description",
          "email",
          "username",
        ];
        return textFields
          .map((field) => {
            const tableField = (this.table as any)[field];
            return tableField ? ilike(tableField, `%${term}%`) : null;
          })
          .filter(Boolean);
      }) as SQL[];

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting
    const sortByField = (this.table as any)[sortBy];
    if (sortByField) {
      query = query.orderBy(
        sortOrder === "desc" ? desc(sortByField) : sortByField,
      ) as typeof query;
    }

    // Get total count
    const countQuery = this.db
      .select({ count: count() })
      .from(this.table as PgTable);

    if (conditions.length > 0) {
      const countQueryWithFilters = await countQuery.where(and(...conditions));
      const totalCount = countQueryWithFilters[0]?.count;
      const itemCount = totalCount ?? 0;

      // Apply pagination
      const items = (await query.limit(validPageSize).offset(offset)) as T[];

      let outItems = items as unknown as R[];

      if (populateChildren) {
        outItems = await this.populateChildrenForItems(items, paginationQuery);
      }

      return {
        items: outItems,
        itemCount,
        page: validPage,
        pageSize: validPageSize,
        pageCount: Math.ceil(itemCount / validPageSize),
      };
    }

    const totalCount = (await countQuery)[0]?.count;
    const itemCount = totalCount ?? 0;

    // Apply pagination
    const items = (await query.limit(validPageSize).offset(offset)) as T[];

    let outItems = items as unknown as R[];

    if (populateChildren) {
      outItems = await this.populateChildrenForItems(items, paginationQuery);
    }

    return {
      items: outItems,
      itemCount,
      page: validPage,
      pageSize: validPageSize,
      pageCount: Math.ceil(itemCount / validPageSize),
    };
  }

  /**
   * Populate children for items when requested. Default implementation is a no-op.
   * Subclasses that have child relations should override this to fetch and attach children.
   */
  protected async populateChildrenForItems(
    items: T[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _paginationQuery?: PaginationQuery,
  ): Promise<R[]> {
    return items as unknown as R[];
  }

  async findAll(
    filters?: Partial<T> & { populateChildren?: boolean },
  ): Promise<T[]> {
    const query = this.db.select().from(this.table as PgTable);

    if (filters) {
      const { populateChildren, ...rest } = filters;

      const conditions = Object.entries(rest)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => eq((this.table as any)[key], value));

      if (conditions.length > 0) {
        const filteredQuery = await query.where(and(...conditions));
        if (populateChildren) {
          return this.populateChildrenForItems(
            filteredQuery as T[],
            rest as PaginationQuery,
          );
        }
        return filteredQuery as T[];
      }

      if (populateChildren) {
        const rows = await query.execute();
        return this.populateChildrenForItems(
          rows as T[],
          rest as PaginationQuery,
        );
      }
    }

    return query as Promise<T[]>;
  }

  async findOne(filters?: Partial<T>): Promise<R | null> {
    const query = this.db.select().from(this.table as PgTable);

    let entity: T | null = null;

    if (filters) {
      const conditions = Object.entries(filters)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => eq((this.table as any)[key], value));

      if (conditions.length > 0) {
        const [result] = await query.where(and(...conditions)).limit(1);
        entity = result as T;
      }
    }

    if (!entity) {
      const [queryResult] = await query.limit(1);
      entity = queryResult as T;
    }

    if (!entity) return null;

    if (this.populateChildren) {
      const [populated] = await this.populateChildrenForItems([entity]);
      return populated as R;
    }

    return entity as unknown as R;
  }

  async update(id: string | number, dto: UpdateDTO): Promise<R[] | null> {
    this.logger.debug(`Updating entity ${id} in DB`, {
      // table: (this.table as any)[Symbol.for("drizzle:Name")] || "unknown",
      id,
    });
    const result = (await this.db
      .update(this.table)
      .set(dto)
      .where(eq(this.table.id, id))
      .returning()) as T[];

    if (!result || result.length === 0) return null;
    return result as unknown as R[];
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id));
      return result.rowCount ? result.rowCount > 0 : true;
    } catch (error) {
      this.logger.error(
        `Failed to delete entity ${id} from ${(this.table as any)[Symbol.for("drizzle:Name")] || "unknown"}`,
        {
          className: this.constructor.name,
          method: "delete",
          id,
        },
        error,
      );
      throw error;
    }
  }

  /**
   * Delete multiple entities by their IDs
   * @param ids - Array of entity IDs to delete
   * @returns Number of deleted entities
   */
  async deleteMultiple(ids: (string | number)[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.db
      .delete(this.table)
      .where(inArray(this.table.id, ids));

    return result.rowCount ?? 0;
  }

  async findBy<V>(field: keyof T, value: V): Promise<T[]> {
    return this.db
      .select()
      .from(this.table as PgTable)
      .where(eq((this.table as any)[field], value)) as Promise<T[]>;
  }

  async findOneBy<V>(field: keyof T, value: V): Promise<T | null> {
    const [result] = await this.db
      .select()
      .from(this.table as PgTable)
      .where(eq((this.table as any)[field], value))
      .limit(1);
    return (result as T) || null;
  }

  async count(filters?: Partial<T>): Promise<number> {
    const query = this.db.select().from(this.table as PgTable);

    if (filters) {
      const conditions = Object.entries(filters)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => eq((this.table as any)[key], value));

      if (conditions.length > 0) {
        const filteredQuery = await query.where(and(...conditions));
        return filteredQuery.length;
      }
    }

    const result = await query;
    return result.length;
  }

  async exists(id: string | number): Promise<boolean> {
    const result = await this.findById(id);
    return result !== null;
  }

  /**
   * Get statistics for entities based on creation date
   * @returns EntityStatistics with monthly, weekly, and yearly comparisons
   */
  async getStatistics(): Promise<EntityStatistics> {
    const now = new Date();

    // Monthly statistics
    const monthly = await this.getPeriodStatistics(
      this.getMonthRange(now),
      this.getMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      "month",
    );

    // Weekly statistics
    const weekly = await this.getPeriodStatistics(
      this.getWeekRange(now),
      this.getWeekRange(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      "week",
    );

    // Yearly statistics
    const yearly = await this.getPeriodStatistics(
      this.getYearRange(now),
      this.getYearRange(new Date(now.getFullYear() - 1, 0, 1)),
      "year",
    );

    return {
      monthly,
      weekly,
      yearly,
    };
  }

  /**
   * Get statistics for a specific period compared to previous period
   */
  private async getPeriodStatistics(
    currentRange: { start: Date; end: Date },
    previousRange: { start: Date; end: Date },
    periodType: "month" | "week" | "year",
  ): Promise<StatisticsComparison> {
    const createdAtField = (this.table as any).createdAt;

    if (!createdAtField) {
      throw new Error("Table must have a createdAt field for statistics");
    }

    // Count for current period
    const [currentResult] = await this.db
      .select({ count: count() })
      .from(this.table as PgTable)
      .where(
        and(
          gte(createdAtField, currentRange.start),
          lte(createdAtField, currentRange.end),
        ),
      );

    const currentCount = currentResult?.count ?? 0;

    // Count for previous period
    const [previousResult] = await this.db
      .select({ count: count() })
      .from(this.table as PgTable)
      .where(
        and(
          gte(createdAtField, previousRange.start),
          lte(createdAtField, previousRange.end),
        ),
      );

    const previousCount = previousResult?.count ?? 0;

    // Calculate growth
    const growth = currentCount - previousCount;
    const growthPercentage =
      previousCount > 0
        ? Math.round((growth / previousCount) * 100 * 100) / 100
        : currentCount > 0
          ? 100
          : 0;

    // Calculate percentage of total
    const totalCount = currentCount + previousCount;
    const currentPercentage =
      totalCount > 0
        ? Math.round((currentCount / totalCount) * 100 * 100) / 100
        : 0;
    const previousPercentage =
      totalCount > 0
        ? Math.round((previousCount / totalCount) * 100 * 100) / 100
        : 0;

    return {
      current: {
        count: currentCount,
        period: this.formatPeriod(currentRange.start, periodType),
        percentage: currentPercentage,
      },
      previous: {
        count: previousCount,
        period: this.formatPeriod(previousRange.start, periodType),
        percentage: previousPercentage,
      },
      growth,
      growthPercentage,
    };
  }

  /**
   * Get start and end dates for a month
   */
  private getMonthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  /**
   * Get start and end dates for a week (Monday to Sunday)
   */
  private getWeekRange(date: Date): { start: Date; end: Date } {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Get start and end dates for a year
   */
  private getYearRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Format period for display
   */
  private formatPeriod(date: Date, type: "month" | "week" | "year"): string {
    if (type === "year") {
      return date.getFullYear().toString();
    }
    if (type === "month") {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    // Week
    const weekNumber = this.getWeekNumber(date);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
