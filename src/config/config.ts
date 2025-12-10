const config = {
  db: {
    username: process.env.DB_USER,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres", // Corrected dialect
  },
};

export default config;
