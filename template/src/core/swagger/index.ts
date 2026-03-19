/* eslint-disable @typescript-eslint/no-explicit-any */
// src/core/swagger/index.ts
import { SwaggerUI } from "@hono/swagger-ui";
import type { Hono } from "hono";
import {
  getAllControllers,
  getControllerMetadata,
  getMiddlewareMetadata,
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

  /**
   * Generate OpenAPI specification from decorated controllers
   */
  generateSpec(): any {
    // Generate schemas from DTOs
    this.generateSchemas();

    const paths: Record<string, any> = {};
    const tags = new Set<string>();

    // Iterate through all registered controllers
    const controllers = getAllControllers();

    for (const ControllerClass of controllers) {
      const controllerMetadata = getControllerMetadata(ControllerClass);
      if (!controllerMetadata) continue;

      const { basePath, tags: controllerTags } = controllerMetadata;

      // Add controller tags
      if (controllerTags) {
        controllerTags.forEach((tag) => tags.add(tag));
      }

      // Get routes for this controller
      const routes = getRouteMetadata(ControllerClass) || [];

      for (const route of routes) {
        const fullPath = this.normalizePath(basePath, route.path || "");
        const method = route.method || "get";

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        // Build operation object
        const operation: any = {
          summary:
            route.summary ||
            route.description ||
            `${method.toUpperCase()} ${fullPath}`,
          description: route.description,
          tags: controllerTags || [],
        };

        // Add deprecated flag
        if (route.deprecated) {
          operation.deprecated = true;
        }

        // Add parameters (path, query)
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

        // Add request body
        if (
          route.body &&
          (method === "post" || method === "put" || method === "patch")
        ) {
          // Handle multipart/form-data (file uploads)
          if (
            route.body.type === "multipart/form-data" &&
            route.body.properties
          ) {
            const properties: Record<string, any> = {};
            const requiredFields: string[] = [];

            for (const [propName, propInfo] of Object.entries(
              route.body.properties,
            )) {
              const propConfig = propInfo as any;
              if (propConfig.type === "file") {
                properties[propName] = {
                  type: "string",
                  format: "binary",
                  description: propConfig.description,
                };
              } else {
                properties[propName] = {
                  type: propConfig.type || "string",
                  description: propConfig.description,
                };
              }

              if (propConfig.required) {
                requiredFields.push(propName);
              }
            }

            operation.requestBody = {
              required: route.body.required ?? true,
              content: {
                "multipart/form-data": {
                  schema: {
                    type: "object",
                    properties,
                    ...(requiredFields.length > 0 && {
                      required: requiredFields,
                    }),
                  },
                },
              },
            };
          } else {
            // Handle standard JSON body
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
        }

        // Add responses
        if (!route.handler) continue;

        const apiResponses =
          getSwaggerMetadata(ControllerClass.prototype, route.handler) || {};
        const allResponses = { ...apiResponses, ...(route.responses || {}) };

        operation.responses = {};

        // Transform into OpenAPI 3.0 response structure
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

        // Add default responses if not specified
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

        // Add security requirements for routes with auth middleware
        const middlewares =
          getMiddlewareMetadata(ControllerClass.prototype, route.handler) || [];
        const hasAuthMiddleware = middlewares.some(
          (mw: any) =>
            mw?.name === "authMiddleware" ||
            mw?.name === "jwt" ||
            (typeof mw === "function" && mw.toString().includes("jwtPayload")),
        );

        if (hasAuthMiddleware) {
          operation.security = [{ bearerAuth: [] }, { cookieAuth: [] }];

          // Add 401 response if not present
          if (!operation.responses["401"]) {
            operation.responses["401"] = {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                  },
                },
              },
            };
          }
        }

        paths[fullPath][method] = operation;
      }
    }

    // Build OpenAPI spec
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
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "session",
          },
        },
      },
    };
  }

  /**
   * Generate JSON schemas from DTO classes
   */
  private generateSchemas() {
    try {
      const dtoClasses = getAllDTOs();
      // Ensure DTOs are registered (though they should be by decorators)
      // We just log to avoid unused variable and verify count
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

      // Ensure all registered DTOs have schemas, even if empty
      for (const dtoClass of dtoClasses) {
        if (dtoClass.name && !schemas[dtoClass.name]) {
          console.debug(`Creating empty schema for ${dtoClass.name}`);
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

  /**
   * Get schema reference for a DTO class
   */
  private getSchemaRef(dtoClass: any): any {
    if (typeof dtoClass === "string") {
      return { $ref: `#/components/schemas/${dtoClass}` };
    }

    if (dtoClass?.name) {
      // Check if this DTO is registered in our schemas
      if (this.schemas[dtoClass.name]) {
        return { $ref: `#/components/schemas/${dtoClass.name}` };
      }

      // For dynamic classes, try different naming patterns
      let baseName = dtoClass.name;

      // Handle PartialDTO pattern
      if (baseName.startsWith("Partial")) {
        baseName = baseName.replace("Partial", "");
        if (this.schemas[baseName]) {
          return { $ref: `#/components/schemas/${baseName}` };
        }
      }

      // Handle CreateBase with exclude pattern
      if (baseName.includes("_excluded_")) {
        baseName = baseName.split("_excluded_")[0];
        if (this.schemas[baseName]) {
          return { $ref: `#/components/schemas/${baseName}` };
        }
        // Also try to full name
        if (this.schemas[dtoClass.name]) {
          return { $ref: `#/components/schemas/${dtoClass.name}` };
        }
      }

      // Try to find any schema that starts with the base name
      const tableBaseName = baseName.replace("Base", "");
      const matchingSchemas = [];
      for (const schemaName of Object.keys(this.schemas)) {
        if (schemaName.startsWith(tableBaseName)) {
          matchingSchemas.push(schemaName);
        }
      }

      // If only one matching schema, use it
      if (matchingSchemas.length === 1) {
        return { $ref: `#/components/schemas/${matchingSchemas[0]}` };
      }

      // If multiple schemas, prefer the one with actual content
      if (matchingSchemas.length > 1) {
        // For PaginatedResponseDTO, prefer the one with excluded fields
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
        // Default to the first one
        return { $ref: `#/components/schemas/${matchingSchemas[0]}` };
      }
    }

    console.warn(
      `Could not find schema for ${dtoClass?.name || dtoClass}, returning empty object`,
    );
    return { type: "object" };
  }

  /**
   * Normalize and combine base path with route path
   */
  private normalizePath(basePath: string, routePath: string): string {
    // Ensure basePath starts with / and remove trailing slashes
    if (!basePath.startsWith("/")) basePath = "/" + basePath;
    basePath = basePath.replace(/\/$/, "");

    // Ensure routePath doesn't double slash and remove trailing slashes
    routePath = routePath.replace(/^\//, "");
    routePath = routePath.replace(/\/$/, "");

    // Combine paths
    const fullPath = routePath ? `${basePath}/${routePath}` : basePath || "/";

    // Convert Hono params (:id) to OpenAPI params ({id})
    return fullPath.replace(/:([^/]+)/g, "{$1}");
  }

  /**
   * Setup Swagger UI routes on a Hono app
   */
  setupSwaggerUI(app: Hono, swaggerPath: string = "/docs") {
    const spec = this.generateSpec();

    // Serve OpenAPI spec as JSON
    app.get(`${swaggerPath}/openapi.json`, (c) => {
      return c.json(spec);
    });

    // Serve Swagger UI
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

/**
 * Helper function to setup Swagger on an app
 */
export function setupSwagger(
  app: Hono,
  config: SwaggerConfig,
  path: string = "/docs",
) {
  const generator = new SwaggerGenerator(config);
  return generator.setupSwaggerUI(app, path);
}
