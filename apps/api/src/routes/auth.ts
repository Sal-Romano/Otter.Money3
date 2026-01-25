import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { ERROR_CODES } from '@otter-money/shared';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  householdName: z.string().optional(),
});

const joinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  inviteCode: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'JWT secret not configured', 500);
  return jwt.sign({ userId }, secret, { expiresIn: '15m' });
}

// Register new user and create household
authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, 'Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user and household in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create household (default name per PRD: "[Name]'s Household")
      const household = await tx.household.create({
        data: {
          name: data.householdName || `${data.name}'s Household`,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          householdId: household.id,
        },
      });

      return { user, household };
    });

    const token = generateToken(result.user.id);

    res.status(201).json({
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatarUrl: result.user.avatarUrl,
          emailVerified: result.user.emailVerified,
          householdId: result.user.householdId,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
        household: {
          id: result.household.id,
          name: result.household.name,
          inviteCode: result.household.inviteCode,
          createdAt: result.household.createdAt,
          updatedAt: result.household.updatedAt,
        },
        accessToken: token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Register and join existing household
authRouter.post('/register/join', async (req, res, next) => {
  try {
    const data = joinSchema.parse(req.body);

    // Find household by invite code
    const household = await prisma.household.findUnique({
      where: { inviteCode: data.inviteCode },
      include: { members: true },
    });

    if (!household) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invalid invite code', 404);
    }

    // Check household isn't full (max 2 members)
    if (household.members.length >= 2) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Household already has 2 members', 403);
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, 'Email already registered', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        householdId: household.id,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          householdId: user.householdId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        household: {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          updatedAt: household.updatedAt,
        },
        accessToken: token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Login
authRouter.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { household: true },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', 401);
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Invalid email or password', 401);
    }

    const token = generateToken(user.id);

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          householdId: user.householdId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        household: user.household
          ? {
              id: user.household.id,
              name: user.household.name,
              inviteCode: user.household.inviteCode,
              createdAt: user.household.createdAt,
              updatedAt: user.household.updatedAt,
            }
          : null,
        accessToken: token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Logout (client-side token removal, server could blacklist token here)
authRouter.post('/logout', (_req, res) => {
  res.json({ data: { success: true } });
});

// Request password reset
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ data: { success: true } });
      return;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // In production, send email here with reset link
    // For now, we'll return the token in development for testing
    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      data: {
        success: true,
        // Only include token in dev for testing
        ...(isDev && { resetToken: token }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Reset password with token
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invalid or expired reset token', 400);
    }

    if (resetToken.usedAt) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Reset token has already been used', 400);
    }

    if (resetToken.expiresAt < new Date()) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Reset token has expired', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});
