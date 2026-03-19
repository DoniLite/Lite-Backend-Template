import type { PgColumn } from "drizzle-orm/pg-core";

export interface BaseEntity {
  id?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface BaseTable {
  name: string;
  schema: string | undefined;
  columns: Record<keyof BaseRow, PgColumn>;
  dialect: "pg";
}

interface BaseRow {
  id: string | number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CrudOperations<T, CreateDTO, UpdateDTO> {
  create(dto: CreateDTO): Promise<T>;
  findById(id: string | number): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  update(id: string | number, dto: UpdateDTO): Promise<T[] | null>;
  delete(id: string | number): Promise<boolean>;
}

export type bodyGetter = "query" | "formData" | "json";

export type ContextInstance<T extends bodyGetter> = {
  query: Record<string, string | string[]>;
  formData: FormData;
  json: Record<string, unknown>;
}[T];
