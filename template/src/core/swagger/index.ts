/* eslint-disable @typescript-eslint/no-explicit-any */
import { SwaggerUI } from "@hono/swagger-ui";
import type { Hono } from "hono";
import {
  getAllControllers,
  getControllerMetadata,
  getRouteMetadata,
  getSwaggerMetadata,
} from "../decorators";
import { validationMetadatasToSchemas } from "class-validator-jsonschema";
import { getAllDTOs } from "../decorators";
// @ts-expect-error - Internal import for metadata storage
import { defaultMetadataStorage } from "class-transformer/cjs/storage";

export interface SwaggerConfig {
  title: string;
  version: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
}

export class SwaggerGenerator {
  private config: SwaggerConfig;
  private schemas: Record<string, any> = {};

  constructor(config: SwaggerConfig) {
    this.config = config;
  }

  generateSpec(): any {
    this.generateSchemas();

    const paths: Record<string, any> = {};
    const tags = new Set<string>();

    const controllers = getAllControllers();

    for (const ControllerClass of controllers) {
      const controllerMetadata = getControllerMetadata(ControllerClass);
      if (!controllerMetadata) continue;

      const { basePath, tags: controllerTags } = controllerMetadata;

      if (controllerTags) {
        controllerTags.forEach((tag) => tags.add(tag));
      }

      const routes = getRouteMetadata(ControllerClass) || [];

      for (const route of routes) {
        const fullPath = this.normalizePath(basePath, route.path || "");
        const method = route.method || "get";

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        const operation: any = {
          summary:
            route.summary ||
            route.description ||
            `${method.toUpperCase()} ${fullPath}`,
          description: route.description,
          tags: controllerTags || [],
        };

        if (route.deprecated) {
          operation.deprecated = true;
        }

        const parameters = [];

        if (route.params) {
          for (const [name, paramInfo] of Object.entries(route.params)) {
            parameters.push({
              name,
              in: "path",
              required: true,
              schema: { type: paramInfo.type },
              description: paramInfo.description,
            });
          }
        }

        if (route.query) {
          for (const [name, queryInfo] of Object.entries(route.query)) {
            parameters.push({
              name,
              in: "query",
              required: false,
              schema: { type: queryInfo.type },
              description: queryInfo.description,
            });
          }
        }

        if (parameters.length > 0) {
          operation.parameters = parameters;
        }

        if (
          route.body &&
          (method === "post" || method === "put" || method === "patch")
        ) {
          const bodySchema = this.getSchemaRef(route.body);
          operation.requestBody = {
            required: true,
            content: {
              "application/json": {
                schema: bodySchema,
              },
            },
          };
        }

        if (!route.handler) continue;

        const apiResponses =
          getSwaggerMetadata(ControllerClass.prototype, route.handler) || {};
        const allResponses = { ...apiResponses, ...(route.responses || {}) };

        operation.responses = {};

        for (const [status, res] of Object.entries(allResponses)) {
          const responseInfo = res as any;
          const responseBody: any = {
            description: responseInfo.description || "Success",
          };

          if (responseInfo.schema) {
            responseBody.content = {
              "application/json": {
                schema: this.getSchemaRef(responseInfo.schema),
              },
            };
          }

          operation.responses[status] = responseBody;
        }

        if (!operation.responses["200"] && !operation.responses["201"]) {
          operation.responses["200"] = {
            description: "Success",
          };
        }

        if (!operation.responses["400"]) {
          operation.responses["400"] = {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    errors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          property: { type: "string" },
                          constraints: { type: "object" },
                          value: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        }

        paths[fullPath][method] = operation;
      }
    }

    return {
      openapi: "3.0.0",
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      servers: this.config.servers || [
        { url: "http://localhost:3000", description: "Development server" },
      ],
      tags: Array.from(tags).map((tag) => ({ name: tag })),
      paths,
      components: {
        schemas: this.schemas,
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    };
  }

  private generateSchemas() {
    try {
      const dtoClasses = getAllDTOs();
      if (dtoClasses.length > 0) {
        console.debug(`Found ${dtoClasses.length} DTOs for schema generation`);
      }

      const schemas = validationMetadatasToSchemas({
        classTransformerMetadataStorage: defaultMetadataStorage,
        refPointerPrefix: "#/components/schemas/",
        additionalConverters: {
          Object: {
            type: "object",
            additionalProperties: true,
          },
        },
      });

      for (const dtoClass of dtoClasses) {
        if (dtoClass.name && !schemas[dtoClass.name]) {
          schemas[dtoClass.name] = {
            type: "object",
            properties: {},
          };
        }
      }

      this.schemas = {
        ...schemas,
        Object: {
          type: "object",
          additionalProperties: true,
        },
      } as Record<string, any>;
    } catch (error) {
      console.warn("Could not generate schemas from DTOs:", error);
      this.schemas = {};
    }
  }

  private getSchemaRef(dtoClass: any): any {
    if (typeof dtoClass === "string") {
      return { $ref: `#/components/schemas/${dtoClass}` };
    }

    if (dtoClass?.name) {
      if (this.schemas[dtoClass.name]) {
        return { $ref: `#/components/schemas/${dtoClass.name}` };
      }

      let baseName = dtoClass.name;

      if (baseName.startsWith("Partial")) {
        baseName = baseName.replace("Partial", "");
        if (this.schemas[baseName]) {
          return { $ref: `#/components/schemas/${baseName}` };
        }
      }

      if (baseName.includes("_excluded_")) {
        baseName = baseName.split("_excluded_")[0];
        if (this.schemas[baseName]) {
          return { $ref: `#/components/schemas/${baseName}` };
        }
        if (this.schemas[dtoClass.name]) {
          return { $ref: `#/components/schemas/${dtoClass.name}` };
        }
      }

      const tableBaseName = baseName.replace("Base", "");
      const matchingSchemas = [];
      for (const schemaName of Object.keys(this.schemas)) {
        if (schemaName.startsWith(tableBaseName)) {
          matchingSchemas.push(schemaName);
        }
      }

      if (matchingSchemas.length === 1) {
        return { $ref: `#/components/schemas/${matchingSchemas[0]}` };
      }

      if (matchingSchemas.length > 1) {
        if (baseName.startsWith("Paginated")) {
          const paginatedWithExclude = matchingSchemas.find((name) =>
            name.includes("_excluded_"),
          );
          if (paginatedWithExclude) {
            return { $ref: `#/components/schemas/${paginatedWithExclude}` };
          }
        }

        const noExcludeSchema = matchingSchemas.find(
          (name) => !name.includes("_excluded_"),
        );
        if (noExcludeSchema) {
          return { $ref: `#/components/schemas/${noExcludeSchema}` };
        }
        return { $ref: `#/components/schemas/${matchingSchemas[0]}` };
      }
    }

    return { type: "object" };
  }

  private normalizePath(basePath: string, routePath: string): string {
    if (!basePath.startsWith("/")) basePath = "/" + basePath;
    basePath = basePath.replace(/\/$/, "");

    routePath = routePath.replace(/^\//, "");
    routePath = routePath.replace(/\/$/, "");

    const fullPath = routePath ? `${basePath}/${routePath}` : basePath || "/";

    return fullPath.replace(/:([^/]+)/g, "{$1}");
  }

  setupSwaggerUI(app: Hono, swaggerPath: string = "/docs") {
    const spec = this.generateSpec();

    app.get(`${swaggerPath}/openapi.json`, (c) => {
      return c.json(spec);
    });

    app.get(swaggerPath, (c) => {
      return c.html(
        SwaggerUI({
          url: `${swaggerPath}/openapi.json`,
        }),
      );
    });

    return app;
  }
}

export function setupSwagger(
  app: Hono,
  config: SwaggerConfig,
  path: string = "/docs",
) {
  const generator = new SwaggerGenerator(config);
  return generator.setupSwaggerUI(app, path);
}
