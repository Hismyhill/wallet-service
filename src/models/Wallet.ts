import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const Wallet = sequelize.define(
  "Wallet",
  {
    wallet_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      defaultValue: () => Math.random().toString(36).substring(2, 15),
    },
    balance: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
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

export default Wallet;
