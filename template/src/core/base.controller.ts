/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context, Hono, MiddlewareHandler } from "hono";
import type { BaseService } from "./base.service";
import type { BaseEntity } from "./types/base";
import { logger, type LogContext } from "./logger";
import type { Variables } from "@/factory/web.factory";
import { ResponseHelper } from "@/helpers/response.helper";
import {
  getRouteMetadata,
  getMiddlewareMetadata,
  getCacheMetadata,
  getRateLimitMetadata,
  getSerializeMetadata,
} from "./decorators";
import { cacheMiddleware } from "../middleware/cache.middleware";
import { rateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { serialize } from "../middleware/serialize.middleware";
import { BaseDTO } from "./dto";

export interface RouteMiddlewares {
  all?: MiddlewareHandler<{ Variables: Variables }>[];
  [key: `${string}`]: MiddlewareHandler<{ Variables: Variables }>[] | undefined;
}

export interface ControllerOptions {
  middlewares?: RouteMiddlewares;
  excludeRoutes?: string[];
}

export abstract class BaseController<
  T extends BaseEntity = BaseEntity,
  CreateDTO extends object = BaseDTO,
  UpdateDTO extends object = Partial<BaseDTO>,
  Service extends BaseService<T, CreateDTO, UpdateDTO, any> = BaseService<
    T,
    CreateDTO,
    UpdateDTO,
    any
  >,
> {
  protected service: Service;
  protected app: Hono<{ Variables: Variables }>;
  protected options: ControllerOptions;
  protected logger = logger;

  constructor(
    service: Service,
    app: Hono<{ Variables: Variables }>,
    options: ControllerOptions = {},
  ) {
    this.service = service;
    this.app = app;
    this.options = {
      middlewares: options.middlewares || {},
      excludeRoutes: options.excludeRoutes || [],
    };

    this.registerRoutes();
  }

  protected handleError(c: Context, error: unknown) {
    const context: LogContext = {
      method: c.req.method,
      path: c.req.path,
      className: this.constructor.name,
    };

    this.logger.error("Controller Error", context, error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return c.json(
          ResponseHelper.error(error.message, { name: error.name }),
          404,
        );
      }
      return c.json(
        ResponseHelper.error(error.message, { name: error.name }),
        500,
      );
    }

    return c.json(ResponseHelper.error("An unexpected error occurred"), 500);
  }

  protected registerCustomRoutes(): void {}

  private registerRoutes(): void {
    this.registerDecoratedRoutes();
    this.registerCustomRoutes();
  }

  private registerDecoratedRoutes() {
    const { middlewares = {}, excludeRoutes = [] } = this.options;

    const prototype = Object.getPrototypeOf(this);
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== "constructor" && typeof (this as any)[name] === "function",
    );

    for (const methodName of methodNames) {
      if (excludeRoutes.includes(methodName as any)) {
        this.logger.debug(
          `Skipping excluded route: ${this.constructor.name}.${methodName}`,
        );
        continue;
      }

      const routes = getRouteMetadata(this.constructor) || [];

      const methodRoutes = routes.filter(
        (r) => (r as any).handler === methodName,
      );

      for (const route of methodRoutes) {
        if (!route.method) continue;

        const path = route.path || "/";
        const method = route.method.toLowerCase() as
          | "get"
          | "post"
          | "put"
          | "patch"
          | "delete";

        const allMiddlewares: MiddlewareHandler<{ Variables: Variables }>[] =
          [];

        if (middlewares.all) {
          allMiddlewares.push(...middlewares.all);
        }

        const methodTypeMiddlewares = middlewares[method];
        if (methodTypeMiddlewares) {
          allMiddlewares.push(...methodTypeMiddlewares);
        }

        const namedMiddlewares = middlewares[methodName];
        if (namedMiddlewares) {
          allMiddlewares.push(...namedMiddlewares);
        }

        const decoratorMiddlewares =
          getMiddlewareMetadata(prototype, methodName) || [];
        allMiddlewares.push(...decoratorMiddlewares);

        const cacheOptions = getCacheMetadata(prototype, methodName);
        if (cacheOptions) {
          allMiddlewares.push(cacheMiddleware(cacheOptions));
        }

        const rateLimitOptions = getRateLimitMetadata(prototype, methodName);
        if (rateLimitOptions) {
          allMiddlewares.push(rateLimitMiddleware(rateLimitOptions));
        }

        const originalHandler = (this as any)[methodName].bind(this);

        const serializeOptions = getSerializeMetadata(prototype, methodName);
        const handler = serializeOptions
          ? async (c: Context) => {
              const response = await originalHandler(c);

              if (!response) {
                return response;
              }

              if (response instanceof Response) {
                const contentType = response.headers.get("content-type");
                const status = response.status;

                if (
                  contentType?.includes("application/json") &&
                  status >= 200 &&
                  status < 300
                ) {
                  const body = await response.json();
                  const transformed = serialize(body, {
                    dto: serializeOptions.dto,
                    isArray: serializeOptions.isArray,
                  });
                  return c.json(transformed, status as any);
                }
                return response;
              }
              return response;
            }
          : originalHandler;

        this.app[method](path, ...allMiddlewares, handler);

        this.logger.debug(
          `Registered decorated route: ${method.toUpperCase()} ${path} -> ${this.constructor.name}.${methodName} with ${allMiddlewares.length} middlewares${serializeOptions ? ` [Serialize: ${serializeOptions.dto.name}]` : ""}`,
        );
      }
    }
  }

  public getApp(): Hono<{ Variables: Variables }> {
    return this.app;
  }
}
