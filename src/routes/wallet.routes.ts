/// <reference path="../types/express.d.ts" />
import express from "express";
import Transaction from "../models/Transaction.js";
import crypto from "crypto";
import {
  protectJwtOrApiKey,
  requirePermission,
} from "../middleware/auth.middleware.js";
import { WalletService } from "../services/walletService.js";
import Wallet from "../models/Wallet.js";
import axios from "axios";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management endpoints
 */

/**
 * @swagger
 * /wallet/deposit:
 *   post:
 *     summary: Initialize a wallet deposit with Paystack
 *     tags: [Wallet]
 *     description: Initialize a payment deposit to the user's wallet
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *     responses:
 *       201:
 *         description: Deposit initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reference:
 *                   type: string
 *                 authorization_url:
 *                   type: string
 */
router.post(
  "/deposit",
  protectJwtOrApiKey,
  requirePermission(["deposit"]),
  async (req, res) => {
    const { amount } = req.body;
    const userId = req.user?.id as number;
    const email = req.user?.email;

    if (!amount || amount < 100) {
      return res.status(400).json({
        error: "Amount must be atleast 100.",
      });
    }
    if (!Number.isInteger(amount) || !amount)
      return res.status(400).json({
        error:
          "Invalid amount. Amount must be an integer representing the smallest currency unit (e.g., kobo).",
      });

    try {
      // Ensure wallet exists
      await WalletService.getOrCreateWallet(userId);

      // 2. Check if the user already has a pending transaction
      const existingTransaction: string | any = await Transaction.findOne({
        where: { userId, status: "pending" },
      });

      if (existingTransaction) {
        return res.status(409).json({
          message:
            "You already have a pending transaction. Please complete or wait for it to expire.",
          authorization_url: existingTransaction.authorization_url,
          reference: existingTransaction.reference,
        });
      }

      // 3. Initialize transaction with Paystack
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount,
          email,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const { reference, authorization_url } = response.data.data;

      // 2. Save transaction
      const tx: any = await Transaction.create({
        reference,
        amount,
        status: "pending",
        type: "deposit",
        authorization_url,
        userId,
      });

      res.status(201).json({
        reference,
        authorization_url,
      });
    } catch (error: any) {
      console.log(error.response?.data || error);
      res.status(402).json({ error: "Payment initiation failed" });
    }
  }
);

/**
 * @swagger
 * /wallet/paystack/webhook:
 *   post:
 *     summary: Paystack webhook handler
 *     tags: [Wallet]
 *     description: >
 *       Listens for events from Paystack, such as `charge.success`.
 *       It verifies the event's authenticity using the `x-paystack-signature` header.
 *       If the event is valid and the charge is successful, it updates the corresponding transaction status in the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             description: The webhook payload sent by Paystack.
 *             example:
 *               event: "charge.success"
 *               data: { reference: "T123456789", status: "success", amount: 5000, paid_at: "2023-10-27T10:30:00.000Z" }
 *     parameters:
 *       - in: header
 *         name: x-paystack-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC SHA512 signature of the request body to verify the event's authenticity.
 *     responses:
 *       200:
 *         description: Webhook received and processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad Request - Invalid signature.
 *       404:
 *         description: Not Found - The transaction reference from the webhook was not found in the database.
 *       500:
 *         description: Internal Server Error.
 */
router.post(
  "/paystack/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"];

    // Use raw body for signature verification (req.body is a Buffer)
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
      .update(req.body)
      .digest("hex");

    if (hash !== signature) {
      console.error("Invalid webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Parse the body after verification
    const payload = JSON.parse(req.body.toString());
    const event = payload.event;
    const data = payload.data;

    try {
      console.log(
        `Webhook received: ${event}, reference: ${data.reference}, status: ${data.status}`
      );

      const tx: any = await Transaction.findOne({
        where: { reference: data.reference },
      });

      if (!tx) {
        console.error(`Transaction not found: ${data.reference}`);
        return res.status(404).json({ error: "Transaction not found" });
      }

      console.log(
        `Found transaction. Current status: ${tx.status}, New status: ${data.status}`
      );

      // Only credit wallet if transitioning from pending to success
      if (tx.status === "pending" && data.status === "success") {
        console.log(
          `Crediting wallet for user ${tx.userId} with amount ${tx.amount}`
        );
        // Credit the wallet using verified amount from Paystack
        await WalletService.creditWallet(tx.userId, data.amount);
        console.log(`Wallet credited successfully`);
      }

      // Update transaction status
      await tx.update({
        status: data.status,
        paid_at: data.paid_at,
      });

      console.log(`Transaction updated: ${data.reference} -> ${data.status}`);
      res.json({ status: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     description: Retrieve the current wallet balance
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                 wallet_number:
 *                   type: string
 */
router.get(
  "/balance",
  protectJwtOrApiKey,
  requirePermission(["read"]),
  async (req, res) => {
    const userId = req.user?.id as number;

    try {
      const balance = await WalletService.getBalance(userId);
      const wallet: any = await Wallet.findOne({
        where: { userId },
        raw: true,
      } as any);

      res.json({
        balance,
        wallet_number: wallet?.wallet_number,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /wallet/transfer:
 *   post:
 *     summary: Transfer funds to another wallet
 *     tags: [Wallet]
 *     description: Transfer funds from your wallet to another user's wallet
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_number
 *               - amount
 *             properties:
 *               wallet_number:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Transfer completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                 reference:
 *                   type: string
 */
router.post(
  "/transfer",
  protectJwtOrApiKey,
  requirePermission(["transfer"]),
  async (req, res) => {
    const { wallet_number, amount } = req.body;
    const userId = req.user?.id as number;

    if (!wallet_number || !amount) {
      return res.status(400).json({
        error: "wallet_number and amount are required",
      });
    }

    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({
        error: "amount must be a positive integer",
      });
    }

    try {
      const result = await WalletService.transfer(
        userId,
        wallet_number,
        amount
      );

      res.json({
        status: "success",
        message: "Transfer completed",
        reference: result.reference,
        new_balance: result.senderNewBalance,
      });
    } catch (error: any) {
      if (error.message === "Insufficient balance") {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      if (error.message === "Recipient wallet not found") {
        return res.status(404).json({ error: "Recipient wallet not found" });
      }
      if (error.message === "Cannot transfer to your own wallet") {
        return res
          .status(400)
          .json({ error: "Cannot transfer to your own wallet" });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /wallet/paystack/{reference}/status:
 *   get:
 *     summary: Get payment status
 *     tags: [Wallet]
 *     description: >
 *       Retrieves the status of a transaction from the local database.
 *       It also re-verifies the transaction with Paystack to get the latest status and updates the local record before returning the result.
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique transaction reference.
 *     responses:
 *       200:
 *         description: The current status and details of the transaction.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reference:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: success
 *                 amount:
 *                   type: number
 *                 paid_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Not Found - The transaction reference does not exist.
 *       500:
 *         description: Internal Server Error - Failed to verify transaction with Paystack.
 */
router.get("/paystack/:reference/status", async (req, res) => {
  const { reference } = req.params;

  const tx: any = await Transaction.findOne({ where: { reference } });

  if (!tx) return res.status(404).json({ error: "Transaction not found" });

  // Optional: refresh using Paystack verify
  try {
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const info = verify.data.data;

    // Credit wallet if status changed from pending to success
    if (tx.status === "pending" && info.status === "success") {
      console.log(
        `Status check crediting wallet for user ${tx.userId} with amount ${tx.amount}`
      );
      await WalletService.creditWallet(tx.userId, tx.amount);
    }

    await tx.update({
      status: info.status,
      paid_at: info.paid_at,
    });

    res.json({
      reference: tx.reference,
      status: info.status,
      amount: tx.amount,
      paid_at: tx.paid_at,
    });
  } catch (error: any) {
    console.error(error.response?.data || error);
    res.status(500).json({ error: "Failed to verify transaction" });
  }
});

/**
 * @swagger
 * /wallet/transactions:
 *   get:
 *     summary: Get transaction history
 *     tags: [Wallet]
 *     description: Retrieve the transaction history for the user's wallet
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   reference:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [deposit, transfer, withdrawal]
 *                   amount:
 *                     type: number
 *                   status:
 *                     type: string
 *                   paid_at:
 *                     type: string
 *                     format: date-time
 */
router.get(
  "/transactions",
  protectJwtOrApiKey,
  requirePermission(["read"]),
  async (req, res) => {
    const userId = req.user?.id as number;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
      const transactions = await WalletService.getTransactionHistory(
        userId,
        Math.min(limit, 100)
      );
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
