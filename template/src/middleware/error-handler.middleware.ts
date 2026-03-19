/**
 * Global error handling middleware
 */
import { ValidationError } from "../core/decorators";
import { HTTPException } from "hono/http-exception";
import { logger } from "../core/logger";
import type { Context, Next } from "hono";

export function errorHandlerMiddleware() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      logger.error(
        "Request error",
        {
          method: c.req.method,
          path: c.req.path,
        },
        error,
      );

      // Handle validation errors
      if (error instanceof ValidationError) {
        return c.json(
          {
            error: "Validation failed",
            details: error.errors,
          },
          error.statusCode,
        );
      }

      // Handle HTTP exceptions
      if (error instanceof HTTPException) {
        return c.json(
          {
            error: error.message,
          },
          error.status,
        );
      }

      // Handle generic errors
      if (error instanceof Error) {
        return c.json(
          {
            error: error.message,
            name: error.name,
          },
          500,
        );
      }

      // Unknown error
      return c.json(
        {
          error: "An unexpected error occurred",
        },
        500,
      );
    }
  };
}
