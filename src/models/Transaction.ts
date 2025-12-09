import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const Transaction = sequelize.define("Transaction", {
  reference: { type: DataTypes.STRING, unique: true },
  type: {
    type: DataTypes.ENUM("deposit", "transfer", "withdrawal"),
    defaultValue: "deposit",
  },
  amount: DataTypes.BIGINT,
  status: { type: DataTypes.STRING, defaultValue: "pending" },
  paid_at: DataTypes.DATE,
  authorization_url: { type: DataTypes.STRING(512) }, // Store the payment URL
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Users", // This is the table name
      key: "id",
    },
  },
  recipient_id: {
    type: DataTypes.INTEGER,
    references: {
      model: "Users",
      key: "id",
    },
  },
});

export default Transaction;
