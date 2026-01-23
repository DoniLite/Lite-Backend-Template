import "reflect-metadata";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
import { Hono } from "hono";
import api from "@/index.controller";
import { appConfig } from "./core/config/app.config";
import { setupSwagger } from "./core/swagger";
import { errorHandlerMiddleware } from "@/middleware/error-handler.middleware";
import { requestLoggerMiddleware } from "@/middleware/request-logger.middleware";
import { ResponseHelper } from "@/helpers/response.helper";
import { cors } from "hono/cors";

const app = new Hono();

// Global middlewares
app.use(errorHandlerMiddleware());
app.use(requestLoggerMiddleware());
app.use(cors());

app.notFound((c) => {
  return c.json(
    ResponseHelper.error(`The path ${c.req.path} does not exist`),
    404,
  );
});

// Setup Swagger
if (appConfig.swagger.enabled) {
  setupSwagger(
    app,
    {
      title: appConfig.swagger.title,
      version: appConfig.swagger.version,
      description: "API documentation",
      servers: [
        {
          url: `http://${appConfig.host === "0.0.0.0" ? "localhost" : appConfig.host}:${appConfig.port}`,
          description: "Development",
        },
      ],
    },
    appConfig.swagger.path,
  );
}

app.route("/api", api);

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

export default {
  port: appConfig.port,
  hostname: appConfig.host,
  fetch: app.fetch,
};
