/**
 * Express type extensions
 * Extend Express Request to include custom properties
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId?: string;
        username?: string;
        email?: string;
        role?: string;
        permissions?: string[];
        token?: string;
      };
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }

    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

export {};
