/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from "hono";

export interface BaseEntity {
  id: string | number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface CrudOperations<T, CreateDTO, UpdateDTO> {
  create(dto: CreateDTO): Promise<T>;
  findById(id: string | number): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  update(id: string | number, dto: UpdateDTO): Promise<T[] | null>;
  delete(id: string | number): Promise<boolean>;
}

export interface BaseTable {
  name: string;
  schema: undefined;
  columns: {
    id: any;
    createdAt?: any;
    updatedAt?: any;
    deletedAt?: any;
  };
  dialect: string;
}

export type bodyGetter = "json" | "formData" | "query";

export type ContextInstance<T extends bodyGetter> = T extends "json"
  ? Record<string, unknown>
  : T extends "formData"
    ? FormData
    : T extends "query"
      ? Record<string, string>
      : never;

export type ControllerContext = Context;
