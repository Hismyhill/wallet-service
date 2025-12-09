import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string | number;
        email: string;
        [key: string]: any;
      };

      apiKey?: {
        id: number;
        key: string;
        name: string;
        permissions: string[];
        expires_at: string | Date;
        revoked: boolean;
        userId: number;
        [key: string]: any;
      };

      authType?: "jwt" | "apiKey";
    }
  }
}

export {};
