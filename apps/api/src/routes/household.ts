import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';
import { ERROR_CODES } from '@otter-money/shared';

export const householdRouter = Router();

// All routes require authentication
householdRouter.use(authenticate);
householdRouter.use(requireHousehold);

// Middleware: require ORGANIZER role
const requireOrganizer: RequestHandler = async (req, _res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { householdRole: true },
    });

    if (user?.householdRole !== 'ORGANIZER') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only the household organizer can perform this action', 403);
    }

    next();
  } catch (err) {
    next(err);
  }
};

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
        householdRole: true,
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

// Regenerate invite code (organizer only)
householdRouter.post('/invite/regenerate', requireOrganizer, async (req, res, next) => {
  try {
    // Generate new invite code
    const newInviteCode = crypto.randomBytes(16).toString('hex');

    const household = await prisma.household.update({
      where: { id: req.user!.householdId! },
      data: { inviteCode: newInviteCode },
    });

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

// Get partner removal impact (organizer only) - for showing warning before removal
householdRouter.get('/members/:memberId/removal-impact', requireOrganizer, async (req, res, next) => {
  try {
    const { memberId } = req.params;

    // Verify member belongs to this household and is not the organizer
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        householdId: req.user!.householdId!,
      },
    });

    if (!member) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Member not found', 404);
    }

    if (member.householdRole === 'ORGANIZER') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Cannot remove the household organizer', 403);
    }

    // Count accounts and transactions owned by this member
    const [accountCount, transactionCount] = await Promise.all([
      prisma.account.count({
        where: {
          householdId: req.user!.householdId!,
          ownerId: memberId,
        },
      }),
      prisma.transaction.count({
        where: {
          account: {
            householdId: req.user!.householdId!,
            ownerId: memberId,
          },
        },
      }),
    ]);

    res.json({
      data: {
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
        },
        impact: {
          accountCount,
          transactionCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Remove partner from household (organizer only)
householdRouter.delete('/members/:memberId', requireOrganizer, async (req, res, next) => {
  try {
    const { memberId } = req.params;

    // Verify member belongs to this household and is not the organizer
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        householdId: req.user!.householdId!,
      },
    });

    if (!member) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Member not found', 404);
    }

    if (member.householdRole === 'ORGANIZER') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Cannot remove the household organizer', 403);
    }

    // Transfer ownership of partner's accounts to organizer (make them joint accounts)
    await prisma.$transaction([
      // Set partner's accounts to have no owner (joint)
      prisma.account.updateMany({
        where: {
          householdId: req.user!.householdId!,
          ownerId: memberId,
        },
        data: {
          ownerId: null, // Joint account
        },
      }),
      // Remove user from household (but don't delete the user)
      prisma.user.update({
        where: { id: memberId },
        data: {
          householdId: null,
          householdRole: 'PARTNER', // Reset role
        },
      }),
    ]);

    res.json({
      data: {
        success: true,
        message: 'Partner has been removed from the household. Their accounts are now joint accounts.',
      },
    });
  } catch (err) {
    next(err);
  }
});
