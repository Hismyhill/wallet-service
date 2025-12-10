import User from "./User.js";
import Transaction from "./Transaction.js";
import Wallet from "./Wallet.js";
import ApiKey from "./ApiKey.js";

// User associations
User.hasMany(Transaction, {
  foreignKey: "userId",
  as: "transactions",
});

User.hasOne(Wallet, {
  foreignKey: "userId",
  as: "wallet",
});

User.hasMany(ApiKey, {
  foreignKey: "userId",
  as: "apiKeys",
});

// Transaction associations
Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });

Transaction.belongsTo(User, {
  foreignKey: "recipient_id",
  as: "recipient",
});

// Wallet associations
Wallet.belongsTo(User, { foreignKey: "userId", as: "user" });

// ApiKey associations
ApiKey.belongsTo(User, { foreignKey: "userId", as: "user" });
export { User, Transaction, Wallet, ApiKey };
