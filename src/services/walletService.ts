import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import crypto from "crypto";

export class WalletService {
  /**
   * Get or create a wallet for a user
   */
  static async getOrCreateWallet(userId: number) {
    let wallet: any = await Wallet.findOne({
      where: { userId },
      raw: true,
    } as any);

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        wallet_number: this.generateWalletNumber(),
        balance: 0,
      } as any);
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  static async getBalance(userId: number) {
    const wallet = await this.getOrCreateWallet(userId);
    const balance = wallet?.balance || 0;
    return Number(balance);
  }

  /**
   * Credit wallet balance (used by webhook)
   */
  static async creditWallet(userId: number, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = Number(wallet?.balance || 0);
    const amountToAdd = Number(amount);
    const newBalance = currentBalance + amountToAdd;

    console.log(`Crediting wallet: current=${currentBalance}, add=${amountToAdd}, new=${newBalance}`);

    await Wallet.update({ balance: newBalance }, { where: { userId } });

    return newBalance;
  }

  /**
   * Debit wallet balance (used for transfers)
   */
  static async debitWallet(userId: number, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = Number(wallet?.balance || 0);
    const amountToDebit = Number(amount);

    if (currentBalance < amountToDebit) {
      throw new Error("Insufficient balance");
    }

    const newBalance = currentBalance - amountToDebit;

    await Wallet.update({ balance: newBalance }, { where: { userId } });

    return newBalance;
  }

  /**
   * Transfer funds between wallets
   */
  static async transfer(
    senderId: number,
    recipientWalletNumber: string,
    amount: number
  ) {
    // Find recipient by wallet number
    const recipientWallet: any = await Wallet.findOne({
      where: { wallet_number: recipientWalletNumber },
      raw: true,
    } as any);

    if (!recipientWallet) {
      throw new Error("Recipient wallet not found");
    }

    if (recipientWallet?.userId === senderId) {
      throw new Error("Cannot transfer to your own wallet");
    }

    // Debit sender
    const senderNewBalance = await this.debitWallet(senderId, amount);

    // Credit recipient
    const recipientNewBalance = await this.creditWallet(
      recipientWallet?.userId,
      amount
    );

    // Record transaction
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(4).toString("hex");
    const reference = `TRF_${timestamp}_${randomPart}`;

    const transaction = await Transaction.create({
      reference,
      type: "transfer",
      amount,
      status: "success",
      userId: senderId,
      recipient_id: recipientWallet?.userId,
      paid_at: new Date(),
    } as any);

    return {
      reference,
      senderNewBalance,
      recipientNewBalance,
      transaction,
    };
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(userId: number, limit = 50) {
    const transactions = await Transaction.findAll({
      where: {
        userId,
      },
      order: [["createdAt", "DESC"]],
      limit,
      raw: true,
    } as any);

    return transactions.map((tx: any) => ({
      id: tx.id,
      reference: tx.reference,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      paid_at: tx.paid_at,
      createdAt: tx.createdAt,
    }));
  }

  /**
   * Generate unique wallet number
   */
  static generateWalletNumber(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
