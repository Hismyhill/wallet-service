import swaggerJsdoc from "swagger-jsdoc";
import dotenv from "dotenv";

dotenv.config();

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Wallet Service API",
      version: "1.0.0",
      description: "API for managing user wallets, transactions, and API keys.",
    },
    servers: [
      {
        url: "http://localhost:" + process.env.PORT,
        description: "Development server",
      },
      {
        url: "https://wallet-service-hismyhill8300-5v4yvfzz.leapcell.dev/",
        description: "Production server",
      },
    ],
    // Define the security schemes
    components: {
      securitySchemes: {
        // Name for the API Key scheme
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key", // The header name for the API key
        },
        // Name for the JWT Bearer Token scheme
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    // Optional: Define a global security requirement.
    // This makes it so users must be authorized for all endpoints by default.
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
  },
  // Path to the API docs
  apis: ["./src/routes/*.ts", "./src/models/*.ts"], // Point to your route and model files
};

export const specs = swaggerJsdoc(options);
