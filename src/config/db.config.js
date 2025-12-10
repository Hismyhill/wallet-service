import { Sequelize } from "sequelize";
import dbConfigs from "../../config/config.js";

const env = process.env.NODE_ENV || "development";
const config = dbConfigs[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

export default sequelize;
