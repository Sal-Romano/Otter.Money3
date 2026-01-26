import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';

export const accountsRouter = Router();

accountsRouter.use(authenticate);
accountsRouter.use(requireHousehold);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT', 'LOAN', 'MORTGAGE', 'ASSET', 'OTHER']),
  subtype: z.string().max(50).optional(),
  ownerId: z.string().optional().nullable(), // null = joint account
  currentBalance: z.number(),
  currency: z.string().length(3).default('USD'),
  isHidden: z.boolean().default(false),
  excludeFromBudget: z.boolean().default(false),
  excludeFromNetWorth: z.boolean().default(false),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT', 'LOAN', 'MORTGAGE', 'ASSET', 'OTHER']).optional(),
  subtype: z.string().max(50).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isHidden: z.boolean().optional(),
  excludeFromBudget: z.boolean().optional(),
  excludeFromNetWorth: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const updateBalanceSchema = z.object({
  newBalance: z.number(),
  note: z.string().max(500).optional(),
});

// Helper to verify account belongs to user's household
async function getHouseholdAccount(accountId: string, householdId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      owner: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  if (!account) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Account not found', 404);
  }

  if (account.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }

  return account;
}

// Helper to verify owner belongs to household (if provided)
async function validateOwner(ownerId: string | null | undefined, householdId: string) {
  if (ownerId === null || ownerId === undefined) {
    return; // Joint account
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { householdId: true },
  });

  if (!owner || owner.householdId !== householdId) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Owner must be a member of the household', 400);
  }
}

// List all household accounts
accountsRouter.get('/', async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { householdId: req.user!.householdId! },
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });

    // Convert Decimal to number for JSON serialization
    const serializedAccounts = accounts.map((account) => ({
      ...account,
      currentBalance: Number(account.currentBalance),
      availableBalance: account.availableBalance ? Number(account.availableBalance) : null,
    }));

    res.json({ data: serializedAccounts });
  } catch (err) {
    next(err);
  }
});

// Get account summary (totals by type) - MUST be before /:id route
accountsRouter.get('/summary/totals', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const accounts = await prisma.account.findMany({
      where: {
        householdId,
        isHidden: false,
        excludeFromNetWorth: false,
      },
      select: {
        type: true,
        currentBalance: true,
        ownerId: true,
      },
    });

    // Calculate totals
    let totalAssets = 0;
    let totalLiabilities = 0;
    const byPartner: Record<string, { assets: number; liabilities: number }> = {};

    for (const account of accounts) {
      const balance = Number(account.currentBalance);
      const isLiability = ['CREDIT', 'LOAN', 'MORTGAGE'].includes(account.type);
      const ownerId = account.ownerId || 'joint';

      if (!byPartner[ownerId]) {
        byPartner[ownerId] = { assets: 0, liabilities: 0 };
      }

      if (isLiability) {
        // For liabilities, negative balance means we owe money
        totalLiabilities += Math.abs(balance);
        byPartner[ownerId].liabilities += Math.abs(balance);
      } else {
        totalAssets += balance;
        byPartner[ownerId].assets += balance;
      }
    }

    res.json({
      data: {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
        byPartner,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get single account
accountsRouter.get('/:id', async (req, res, next) => {
  try {
    const account = await getHouseholdAccount(req.params.id, req.user!.householdId!);

    res.json({
      data: {
        ...account,
        currentBalance: Number(account.currentBalance),
        availableBalance: account.availableBalance ? Number(account.availableBalance) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Create manual account
accountsRouter.post('/', async (req, res, next) => {
  try {
    const data = createAccountSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Validate owner if provided
    await validateOwner(data.ownerId, householdId);

    // Get max display order
    const maxOrder = await prisma.account.aggregate({
      where: { householdId },
      _max: { displayOrder: true },
    });

    const account = await prisma.account.create({
      data: {
        householdId,
        ownerId: data.ownerId ?? null,
        name: data.name,
        type: data.type,
        subtype: data.subtype,
        connectionType: 'MANUAL',
        currentBalance: new Decimal(data.currentBalance),
        currency: data.currency,
        isHidden: data.isHidden,
        excludeFromBudget: data.excludeFromBudget,
        excludeFromNetWorth: data.excludeFromNetWorth,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      },
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({
      data: {
        ...account,
        currentBalance: Number(account.currentBalance),
        availableBalance: account.availableBalance ? Number(account.availableBalance) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update account
accountsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateAccountSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify account exists and belongs to household
    const existing = await getHouseholdAccount(req.params.id, householdId);

    // Don't allow modifying connected accounts' type
    if (existing.connectionType !== 'MANUAL' && data.type) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Cannot change account type for connected accounts',
        400
      );
    }

    // Validate new owner if provided
    if (data.ownerId !== undefined) {
      await validateOwner(data.ownerId, householdId);
    }

    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        type: data.type,
        subtype: data.subtype,
        ownerId: data.ownerId,
        isHidden: data.isHidden,
        excludeFromBudget: data.excludeFromBudget,
        excludeFromNetWorth: data.excludeFromNetWorth,
        displayOrder: data.displayOrder,
      },
      include: {
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    res.json({
      data: {
        ...account,
        currentBalance: Number(account.currentBalance),
        availableBalance: account.availableBalance ? Number(account.availableBalance) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Delete account
accountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const account = await getHouseholdAccount(req.params.id, householdId);

    // For connected accounts, just mark as disconnected instead of deleting
    if (account.connectionType !== 'MANUAL') {
      await prisma.account.update({
        where: { id: req.params.id },
        data: { connectionStatus: 'DISCONNECTED' },
      });
      res.json({ data: { message: 'Account disconnected' } });
      return;
    }

    // For manual accounts, delete account and all transactions
    await prisma.$transaction([
      prisma.transaction.deleteMany({
        where: { accountId: req.params.id },
      }),
      prisma.account.delete({
        where: { id: req.params.id },
      }),
    ]);

    res.json({ data: { message: 'Account deleted' } });
  } catch (err) {
    next(err);
  }
});

// Update balance (creates adjustment transaction)
accountsRouter.post('/:id/balance', async (req, res, next) => {
  try {
    const data = updateBalanceSchema.parse(req.body);
    const householdId = req.user!.householdId!;
    const account = await getHouseholdAccount(req.params.id, householdId);

    // Only allow balance updates for manual accounts
    if (account.connectionType !== 'MANUAL') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Balance can only be manually updated for manual accounts',
        400
      );
    }

    const currentBalance = Number(account.currentBalance);
    const difference = data.newBalance - currentBalance;

    if (difference === 0) {
      res.json({
        data: {
          ...account,
          currentBalance: Number(account.currentBalance),
          availableBalance: account.availableBalance ? Number(account.availableBalance) : null,
        },
      });
      return;
    }

    // Create adjustment transaction and update balance atomically
    const [, updatedAccount] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          accountId: account.id,
          date: new Date(),
          amount: new Decimal(difference),
          description: data.note || 'Balance adjustment',
          isManual: true,
          isAdjustment: true,
        },
      }),
      prisma.account.update({
        where: { id: account.id },
        data: {
          currentBalance: new Decimal(data.newBalance),
          availableBalance: new Decimal(data.newBalance),
        },
        include: {
          owner: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    res.json({
      data: {
        ...updatedAccount,
        currentBalance: Number(updatedAccount.currentBalance),
        availableBalance: updatedAccount.availableBalance
          ? Number(updatedAccount.availableBalance)
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});
