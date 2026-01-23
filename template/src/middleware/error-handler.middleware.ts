import type { MiddlewareHandler } from "hono";
import { ValidationError } from "@/core/decorators/validation";
import { ResponseHelper } from "@/helpers/response.helper";

export function errorHandlerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json(
          ResponseHelper.error("Validation failed", { errors: error.errors }),
          error.statusCode,
        );
      }

      if (error instanceof Error) {
        console.error("Error:", error.message, error.stack);

        if (error.message.includes("not found")) {
          return c.json(ResponseHelper.error(error.message), 404);
        }

        return c.json(
          ResponseHelper.error(
            process.env.NODE_ENV === "production"
              ? "Internal Server Error"
              : error.message,
          ),
          500,
        );
      }

      return c.json(ResponseHelper.error("An unexpected error occurred"), 500);
    }
  };
}
