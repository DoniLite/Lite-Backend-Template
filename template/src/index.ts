import "reflect-metadata";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
import { Hono } from "hono";
import api from "@/index.controller";
import { authMiddleware } from "@/middleware/auth/auth.middleware";
import { appConfig } from "./core/config/app.config";
import { setupSwagger } from "./core/swagger";
import { errorHandlerMiddleware } from "@/middleware/error-handler.middleware";
import { requestLoggerMiddleware } from "@/middleware/request-logger.middleware";
import { ResponseHelper } from "@/helpers/response.helper";
import { cors } from "hono/cors";

const app = new Hono();

// Global middlewares
app.use(
  cors({
    origin: appConfig.cors.origin, // Allow configured origins
    credentials: appConfig.cors.credentials, // Allow cookies
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    // allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    // exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    // maxAge: 600,
  }),
);
app.use(errorHandlerMiddleware());
app.use(requestLoggerMiddleware());

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
      description: "API documentation with enhanced features",
      servers: [
        {
          url: `http://${appConfig.host === "0.0.0.0" ? "localhost" : appConfig.host}:${appConfig.port}`,
          description: "Development",
        },
        {
          url: "https://api.obaasconsult.net",
          description: "Production",
        },
      ],
    },
    appConfig.swagger.path,
  );
}

app.use("/admin/*", authMiddleware);

app.route("/api", api);

export default {
  port: appConfig.port,
  hostname: appConfig.host,
  fetch: app.fetch,
};
