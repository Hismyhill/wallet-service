import "dotenv/config";

export default {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres", // Corrected dialect
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME_TEST || process.env.DB_NAME, // Fallback to dev DB if test not specified
    host: process.env.DB_HOST,
    dialect: "postgres", // Corrected dialect
  },
  production: {
    username: process.env.DB_USER_PROD, // Assuming production-specific env vars
    password: process.env.DB_PASSWORD_PROD,
    database: process.env.DB_NAME_PROD,
    host: process.env.DB_HOST_PROD,
    dialect: "postgres", // Corrected dialect
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Adjust based on your PostgreSQL provider (e.g., true for self-signed, false for some cloud providers)
      },
    },
  },
};
