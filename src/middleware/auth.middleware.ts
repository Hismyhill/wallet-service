import jwt, { type JwtPayload } from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";
import User from "../models/User.js";
import ApiKey from "../models/ApiKey.js";

// Define a type for our JWT payload to ensure type safety
interface DecodedToken extends JwtPayload {
  id: number;
  email: string;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        throw new Error("Token not found in header");
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as unknown as DecodedToken;

      // Explicitly type the result to match our expected user shape
      const user = await User.findByPk<any>(decoded.id, {
        raw: true, // Return a plain JavaScript object
      });

      if (user) {
        // Only assign to req.user if a user was found
        // The type assertion here satisfies the compiler
        req.user = user;
        req.authType = "jwt";
        return next();
      }

      // If user is not found with the token's ID
      throw new Error("User not found");
    } catch (error) {
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  }

  // This will catch cases where the authorization header is missing
  return res.status(401).json({ error: "Not authorized, no token" });
};

export const protectWithApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKeyHeader = req.headers["x-api-key"];

  if (!apiKeyHeader) {
    return res.status(401).json({ error: "No API key provided" });
  }

  try {
    const apiKey: any = await ApiKey.findOne({
      where: {
        key: apiKeyHeader,
        revoked: false,
      },
      raw: true,
    } as any);

    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Check if API key is expired
    if (new Date(apiKey.expires_at) < new Date()) {
      return res.status(401).json({ error: "API key has expired" });
    }

    // Get the user associated with this API key
    const user = await User.findByPk<any>(apiKey.userId, {
      raw: true,
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    req.apiKey = apiKey;
    req.authType = "apiKey";
    next();
  } catch (error) {
    return res.status(401).json({ error: "API key validation failed" });
  }
};

export const protectJwtOrApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Try JWT first
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return protect(req, res, next);
  }

  // Try API key
  if (req.headers["x-api-key"]) {
    return protectWithApiKey(req, res, next);
  }

  return res.status(401).json({ error: "No authentication method provided" });
};

export const requirePermission = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // JWT users have all permissions
    if (req.authType === "jwt") {
      return next();
    }

    // API key users must have the required permissions
    if (req.authType === "apiKey" && req.apiKey) {
      const permissions = req.apiKey.permissions || [];
      const hasAllPermissions = requiredPermissions.every((perm) =>
        permissions.includes(perm)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: requiredPermissions,
          have: permissions,
        });
      }
    }

    next();
  };
};
