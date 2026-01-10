export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "RPMVault API",
    version: "1.0.0",
    description: "API for motorcycle catalog and details",
  },
  servers: [{ url: "/" }],
  paths: {
    "/bikes": {
      get: {
        summary: "List bikes",
        parameters: [
          { 
            name: "brand", 
            in: "query", 
            description: "Marka filtresi (tek veya virgül ile çoklu: Honda,Yamaha,BMW)",
            schema: { type: "string", maxLength: 512 } 
          },
          { name: "model", in: "query", schema: { type: "string", maxLength: 128 } },
          {
            name: "category",
            in: "query",
            description: "Kategori filtresi (tek veya virgül ile çoklu: Scooter,Naked)",
            schema: { type: "string", maxLength: 512 }
          },
          {
            name: "search",
            in: "query",
            description: "Marka veya modelde arama (case-insensitive, partial)",
            schema: { type: "string", maxLength: 256 }
          },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000, default: 50 } }
        ],
        responses: {
          200: {
            description: "Paginated bikes",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    bikes: { type: "array", items: { type: "object" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/bikes/{id}": {
      get: {
        summary: "Get bike details",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Bike detail" },
          400: { description: "Invalid ID" },
          404: { description: "Not Found" }
        }
      }
    },
    "/health": { get: { summary: "Health", responses: { 200: { description: "Healthy" } } } }
  }
};


