import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ApiKey = sequelize.define(
  "ApiKey",
  {
    key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

export default ApiKey;
