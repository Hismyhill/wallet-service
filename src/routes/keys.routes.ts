/// <reference path="../types/express.d.ts" />
import express from "express";
import crypto from "crypto";
import { protect } from "../middleware/auth.middleware.js";
import ApiKey from "../models/ApiKey.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: API Keys
 *   description: API key management for service-to-service access
 */

/**
 * Helper function to convert expiry string to date
 */
function expiryToDate(expiry: string): Date {
  const now = new Date();
  const value = parseInt(expiry.substring(0, expiry.length - 1));
  const unit = expiry.substring(expiry.length - 1);

  const expiryDate = new Date(now);

  switch (unit.toUpperCase()) {
    case "H":
      expiryDate.setHours(expiryDate.getHours() + value);
      break;
    case "D":
      expiryDate.setDate(expiryDate.getDate() + value);
      break;
    case "M":
      expiryDate.setMonth(expiryDate.getMonth() + value);
      break;
    case "Y":
      expiryDate.setFullYear(expiryDate.getFullYear() + value);
      break;
    default:
      throw new Error("Invalid expiry format. Use 1H, 1D, 1M, or 1Y");
  }

  return expiryDate;
}

/**
 * Generate API key
 */
function generateApiKey(): string {
  return "sk_live_" + crypto.randomBytes(32).toString("hex");
}

/**
 * @swagger
 * /keys/create:
 *   post:
 *     summary: Create a new API key
 *     tags: [API Keys]
 *     description: Generate a new API key with specified permissions. Maximum 5 active keys per user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *               - expiry
 *             properties:
 *               name:
 *                 type: string
 *                 example: wallet-service
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [deposit, transfer, read]
 *                 example: [deposit, transfer, read]
 *               expiry:
 *                 type: string
 *                 enum: [1H, 1D, 1M, 1Y]
 *                 example: 1D
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   type: string
 *                 expires_at:
 *                   type: string
 *                   format: date-time
 *                 name:
 *                   type: string
 *                 permissions:
 *                   type: array
 *       400:
 *         description: Bad Request - Invalid parameters or limit reached
 */
router.post("/create", protect, async (req, res) => {
  const { name, permissions, expiry } = req.body;
  const userId = req.user?.id as number;

  // Validate input
  if (!name || !permissions || !expiry) {
    return res.status(400).json({
      error: "name, permissions, and expiry are required",
    });
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({
      error: "permissions must be a non-empty array",
    });
  }

  // Validate permissions
  const validPermissions = ["deposit", "transfer", "read"];
  const invalidPermissions = permissions.filter(
    (p) => !validPermissions.includes(p)
  );

  if (invalidPermissions.length > 0) {
    return res.status(400).json({
      error: `Invalid permissions: ${invalidPermissions.join(
        ", "
      )}. Valid: ${validPermissions.join(", ")}`,
    });
  }

  // Validate expiry format
  const validExpiry = /^[1-9]\d*(H|D|M|Y)$/.test(expiry);
  if (!validExpiry) {
    return res.status(400).json({
      error: "expiry must be in format: 1H, 1D, 1M, or 1Y",
    });
  }

  try {
    // Check active API key limit
    const activeKeys: any = await ApiKey.count({
      where: {
        userId,
        revoked: false,
      },
    } as any);

    if (activeKeys >= 5) {
      return res.status(400).json({
        error:
          "Maximum 5 active API keys allowed per user. Revoke one to create a new key.",
      });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const expiresAt = expiryToDate(expiry);

    // Save to database
    await ApiKey.create({
      key: apiKey,
      name,
      permissions,
      expires_at: expiresAt,
      userId,
    } as any);

    res.status(201).json({
      api_key: apiKey,
      expires_at: expiresAt.toISOString(),
      name,
      permissions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /keys/list:
 *   get:
 *     summary: List all API keys
 *     tags: [API Keys]
 *     description: Get a list of all API keys for the user (without exposing the actual keys)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: number
 *                   name:
 *                     type: string
 *                   permissions:
 *                     type: array
 *                   expires_at:
 *                     type: string
 *                     format: date-time
 *                   revoked:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
router.get("/list", protect, async (req, res) => {
  const userId = req.user?.id as number;

  try {
    const keys = await ApiKey.findAll({
      where: { userId },
      attributes: [
        "id",
        "name",
        "permissions",
        "expires_at",
        "revoked",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      raw: true,
    } as any);

    res.json(keys);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /keys/revoke/{id}:
 *   post:
 *     summary: Revoke an API key
 *     tags: [API Keys]
 *     description: Revoke an API key to prevent its use
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       404:
 *         description: API key not found
 */
router.post("/revoke/:id", protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id as number;

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId },
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    await apiKey.update({ revoked: true });

    res.json({ status: "success", message: "API key revoked" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /keys/delete/{id}:
 *   post:
 *     summary: Delete an API key
 *     tags: [API Keys]
 *     description: Delete an API key to prevent its use
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       404:
 *         description: API key not found
 */
router.delete("/delete/:id", protect, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id as number;

  try {
    const apiKey = await ApiKey.findOne({
      where: { id, userId },
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    await apiKey.destroy();

    res.json({ status: "success", message: "API key deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /keys/rollover:
 *   post:
 *     summary: Rollover an expired API key
 *     tags: [API Keys]
 *     description: Create a new API key using the same permissions as an expired key
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - expired_key_id
 *               - expiry
 *             properties:
 *               expired_key_id:
 *                 type: integer
 *               expiry:
 *                 type: string
 *                 enum: [1H, 1D, 1M, 1Y]
 *                 example: 1M
 *     responses:
 *       201:
 *         description: New API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   type: string
 *                 expires_at:
 *                   type: string
 *                   format: date-time
 */
router.post("/rollover", protect, async (req, res) => {
  const { expired_key_id, expiry } = req.body;
  const userId = req.user?.id as number;

  if (!expired_key_id || !expiry) {
    return res.status(400).json({
      error: "expired_key_id and expiry are required",
    });
  }

  // Validate expiry format
  const validExpiry = /^[1-9]\d*(H|D|M|Y)$/.test(expiry);
  if (!validExpiry) {
    return res.status(400).json({
      error: "expiry must be in format: 1H, 1D, 1M, or 1Y",
    });
  }

  try {
    const expiredKey: any = await ApiKey.findOne({
      where: { id: expired_key_id, userId },
    });

    if (!expiredKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    // Check if key is actually expired
    if (new Date(expiredKey?.expires_at) > new Date()) {
      return res.status(400).json({
        error: "API key has not expired yet",
      });
    }

    // Check active API key limit
    const activeKeys: any = await ApiKey.count({
      where: {
        userId,
        revoked: false,
      },
    } as any);

    if (activeKeys >= 5) {
      return res.status(400).json({
        error: "Maximum 5 active API keys allowed. Revoke one to rollover.",
      });
    }

    // Generate new API key with same permissions
    const newApiKey = generateApiKey();
    const expiresAt = expiryToDate(expiry);

    await ApiKey.create({
      key: newApiKey,
      name: `${expiredKey?.name} (rolled over)`,
      permissions: expiredKey?.permissions,
      expires_at: expiresAt,
      userId,
    } as any);

    res.status(201).json({
      api_key: newApiKey,
      expires_at: expiresAt.toISOString(),
      name: `${expiredKey?.name} (rolled over)`,
      permissions: expiredKey?.permissions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
