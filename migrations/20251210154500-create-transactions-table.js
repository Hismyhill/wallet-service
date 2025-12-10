"use strict";
import { DataTypes } from "sequelize";

/** @type {import('sequelize-cli').Migration} */

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("Transactions", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("credit", "debit", "transfer"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    description: {
      type: DataTypes.STRING,
    },
    walletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Wallets",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    recipientWalletId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Only for transfers
      references: {
        model: "Wallets",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("Transactions");
}
