"use strict";
import { DataTypes } from "sequelize";

/** @type {import('sequelize-cli').Migration} */

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("Wallets", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    wallet_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
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
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
  await queryInterface.dropTable("Wallets");
}
