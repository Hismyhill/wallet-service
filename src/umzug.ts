import { Umzug, SequelizeStorage } from "umzug";
import sequelize from "./config/db.config.js";
import path from "path";

export const migrator = new Umzug({
  migrations: {
    glob: "migrations/*.js",
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

export type Migration = typeof migrator._types.migration;
