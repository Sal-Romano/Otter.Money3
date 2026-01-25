import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';
import { ERROR_CODES } from '@otter-money/shared';

export const householdRouter = Router();

// All routes require authentication
householdRouter.use(authenticate);
householdRouter.use(requireHousehold);

// Get current household
householdRouter.get('/', async (req, res, next) => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: req.user!.householdId! },
    });

    if (!household) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Household not found', 404);
    }

    res.json({ data: household });
  } catch (err) {
    next(err);
  }
});

// Get household members
householdRouter.get('/members', async (req, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { householdId: req.user!.householdId! },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json({
      data: members.map((m) => ({
        ...m,
        isCurrentUser: m.id === req.user!.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Get invite code
householdRouter.get('/invite', async (req, res, next) => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: req.user!.householdId! },
      select: { inviteCode: true },
    });

    if (!household) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Household not found', 404);
    }

    res.json({
      data: {
        inviteCode: household.inviteCode,
        inviteUrl: `${process.env.APP_URL || 'http://localhost:3001'}/join/${household.inviteCode}`,
      },
    });
  } catch (err) {
    next(err);
  }
});
