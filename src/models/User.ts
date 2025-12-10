import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const User = sequelize.define(
  "User",
  {
    googleId: { type: DataTypes.STRING, unique: true, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: DataTypes.STRING,
    picture: DataTypes.STRING,
    role: { type: DataTypes.STRING, defaultValue: "user" },
  },
  {
    // Explicitly define the table name to match the migration
    tableName: "Users",
    timestamps: true, // Ensure this is true if you want createdAt/updatedAt
  }
);

export default User;
