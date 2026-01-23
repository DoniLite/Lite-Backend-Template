/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClassConstructor } from "class-transformer";

export interface ControllerOptions {
  basePath: string;
  tags?: string[];
  description?: string;
}

export interface RouteOptions {
  method?: "get" | "post" | "put" | "patch" | "delete";
  path?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  handler?: string;
  body?: ClassConstructor<any>;
  params?: Record<string, { type: string; description?: string }>;
  query?: Record<string, { type: string; description?: string }>;
  responses?: Record<
    number,
    { description: string; schema?: ClassConstructor<any> }
  >;
}

export interface RepositoryOptions {
  tableName?: string;
  cache?: boolean;
  cacheTTL?: number;
}

export interface ServiceOptions {
  name?: string;
  singleton?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  key?: string;
}

export interface RateLimitOptions {
  max: number;
  window: number;
}

export interface SerializeOptions {
  dto: ClassConstructor<any>;
  isArray?: boolean;
}
