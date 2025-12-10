import swaggerJsdoc from "swagger-jsdoc";
import dotenv from "dotenv";

dotenv.config();

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "User Authentication and Payment API",
      version: "1.0.0",
      description: "API for managing user wallets, transactions, and API keys.",
      contact: {
        name: "API Support",
        url: "https://github.com/Hismyhill", // Example contact URL
      },
    },
    servers: [
      {
        url: "http://localhost:" + process.env.PORT,
        description: "Development server",
      },
      {
        url: "https://wallet-service-hismyhill8300-5v4yvfzz.leapcell.dev",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        apiKeyAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API routes
};

export const specs = swaggerJsdoc(options);
