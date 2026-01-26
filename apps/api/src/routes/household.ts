import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/error';
import { ERROR_CODES } from '@otter-money/shared';

export const householdRouter = Router();

// All routes require authentication
householdRouter.use(authenticate);

// ============================================
// Routes for users WITHOUT a household
// ============================================

const joinHouseholdSchema = z.object({
  inviteCode: z.string().min(1),
});

// Create a new household (for existing users without one)
householdRouter.post('/create', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    if (user.householdId) {
      throw new AppError(ERROR_CODES.CONFLICT, 'You are already in a household', 409);
    }

    // Create household and update user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: `${user.name}'s Household`,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          householdId: household.id,
          householdRole: 'ORGANIZER',
        },
      });

      return household;
    });

    res.status(201).json({
      data: {
        household: {
          id: result.id,
          name: result.name,
          inviteCode: result.inviteCode,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Join an existing household (for existing users without one)
householdRouter.post('/join', async (req, res, next) => {
  try {
    const data = joinHouseholdSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    if (user.householdId) {
      throw new AppError(ERROR_CODES.CONFLICT, 'You are already in a household. Leave or dissolve it first.', 409);
    }

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

    // Update user to join household
    await prisma.user.update({
      where: { id: user.id },
      data: {
        householdId: household.id,
        householdRole: 'PARTNER',
      },
    });

    res.json({
      data: {
        household: {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          createdAt: household.createdAt,
          updatedAt: household.updatedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// Routes that REQUIRE a household
// ============================================
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

// Partner leaves household voluntarily
householdRouter.post('/leave', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { householdId: true, householdRole: true },
    });

    if (!user?.householdId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'You are not in a household', 404);
    }

    if (user.householdRole === 'ORGANIZER') {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Organizers cannot leave. Use dissolve to delete the household.',
        403
      );
    }

    // Transfer ownership of user's accounts to joint
    await prisma.$transaction([
      prisma.account.updateMany({
        where: {
          householdId: user.householdId,
          ownerId: req.user!.id,
        },
        data: {
          ownerId: null, // Joint account
        },
      }),
      prisma.user.update({
        where: { id: req.user!.id },
        data: {
          householdId: null,
          householdRole: 'PARTNER',
        },
      }),
    ]);

    res.json({
      data: {
        success: true,
        message: 'You have left the household. Your accounts are now joint accounts.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Dissolve household (organizer only) - deletes household and all data
householdRouter.post('/dissolve', requireOrganizer, async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    // Get all members to remove them from household
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true },
    });

    // Delete everything in a transaction
    await prisma.$transaction([
      // Delete all transactions for this household's accounts
      prisma.transaction.deleteMany({
        where: { account: { householdId } },
      }),
      // Delete all accounts
      prisma.account.deleteMany({
        where: { householdId },
      }),
      // Delete all budgets
      prisma.budget.deleteMany({
        where: { householdId },
      }),
      // Delete all goals
      prisma.goal.deleteMany({
        where: { householdId },
      }),
      // Delete all categories
      prisma.category.deleteMany({
        where: { householdId },
      }),
      // Delete all categorization rules
      prisma.categorizationRule.deleteMany({
        where: { householdId },
      }),
      // Remove all members from household
      prisma.user.updateMany({
        where: { householdId },
        data: {
          householdId: null,
          householdRole: 'PARTNER',
        },
      }),
      // Delete the household itself
      prisma.household.delete({
        where: { id: householdId },
      }),
    ]);

    res.json({
      data: {
        success: true,
        message: 'Household has been dissolved. All data has been deleted.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get dissolution impact (organizer only) - for showing warning before dissolving
householdRouter.get('/dissolve/impact', requireOrganizer, async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const [memberCount, accountCount, transactionCount] = await Promise.all([
      prisma.user.count({ where: { householdId } }),
      prisma.account.count({ where: { householdId } }),
      prisma.transaction.count({ where: { account: { householdId } } }),
    ]);

    res.json({
      data: {
        impact: {
          memberCount,
          accountCount,
          transactionCount,
        },
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
