import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@otter-money/shared';
import { AppError } from './error';
import { prisma } from '../utils/prisma';

export interface AuthUser {
  id: string;
  email: string;
  householdId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Missing or invalid token', 401);
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'JWT secret not configured', 500);
    }

    const payload = jwt.verify(token, secret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, householdId: true },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'User not found', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Invalid token', 401));
    } else {
      next(err);
    }
  }
}

// Middleware to require household membership
export function requireHousehold(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.householdId) {
    return next(new AppError(ERROR_CODES.FORBIDDEN, 'No household associated', 403));
  }
  next();
}
