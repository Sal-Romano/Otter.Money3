import { Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import { applyRulesToTransaction } from '../services/ruleEngine';

export const transactionsRouter = Router();

transactionsRouter.use(authenticate);
transactionsRouter.use(requireHousehold);

// Validation schemas
const createTransactionSchema = z.object({
  accountId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  amount: z.number(), // Negative = expense, positive = income
  description: z.string().min(1).max(500),
  merchantName: z.string().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional(),
});

const updateTransactionSchema = z.object({
  date: z.string().transform((s) => new Date(s)).optional(),
  amount: z.number().optional(),
  description: z.string().min(1).max(500).optional(),
  merchantName: z.string().max(200).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// Helper to serialize transaction (convert Decimal to number)
function serializeTransaction(tx: any) {
  return {
    ...tx,
    amount: Number(tx.amount),
  };
}

// Helper to verify account belongs to household
async function verifyAccountAccess(accountId: string, householdId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { householdId: true },
  });

  if (!account) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Account not found', 404);
  }

  if (account.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }
}

// Helper to verify transaction belongs to household
async function getHouseholdTransaction(transactionId: string, householdId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      account: {
        select: { id: true, name: true, type: true, ownerId: true, householdId: true },
      },
      category: {
        select: { id: true, name: true, type: true, icon: true, color: true },
      },
    },
  });

  if (!transaction) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Transaction not found', 404);
  }

  if (transaction.account.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }

  return transaction;
}

// List transactions with filters
transactionsRouter.get('/', async (req, res, next) => {
  try {
    const {
      accountId,
      categoryId,
      ownerId, // Filter by account owner
      startDate,
      endDate,
      search,
      limit = '50',
      offset = '0',
      includeAdjustments = 'false',
    } = req.query;

    const householdId = req.user!.householdId!;

    // Build where clause
    const where: any = {
      account: { householdId },
    };

    if (accountId) {
      where.accountId = String(accountId);
    }

    if (categoryId) {
      if (categoryId === 'uncategorized') {
        where.categoryId = null;
      } else {
        where.categoryId = String(categoryId);
      }
    }

    if (ownerId) {
      if (ownerId === 'joint') {
        where.account.ownerId = null;
      } else {
        where.account.ownerId = String(ownerId);
      }
    }

    if (startDate) {
      where.date = { ...where.date, gte: new Date(String(startDate)) };
    }

    if (endDate) {
      where.date = { ...where.date, lte: new Date(String(endDate)) };
    }

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { description: { contains: searchStr, mode: 'insensitive' } },
        { merchantName: { contains: searchStr, mode: 'insensitive' } },
        { notes: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    if (includeAdjustments !== 'true') {
      where.isAdjustment = false;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              ownerId: true,
              owner: { select: { id: true, name: true } },
            },
          },
          category: {
            select: { id: true, name: true, type: true, icon: true, color: true },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions.map(serializeTransaction),
      meta: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get single transaction
transactionsRouter.get('/:id', async (req, res, next) => {
  try {
    const transaction = await getHouseholdTransaction(
      req.params.id,
      req.user!.householdId!
    );

    res.json({ data: serializeTransaction(transaction) });
  } catch (err) {
    next(err);
  }
});

// Create manual transaction
transactionsRouter.post('/', async (req, res, next) => {
  try {
    const data = createTransactionSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify account belongs to household
    await verifyAccountAccess(data.accountId, householdId);

    // Verify category belongs to household (if provided)
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { householdId: true, isSystem: true },
      });

      if (!category) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
      }

      // Category must be system or belong to this household
      if (!category.isSystem && category.householdId !== householdId) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Category access denied', 403);
      }
    }

    let finalCategoryId = data.categoryId;

    // If no category provided, try to apply rules
    if (!finalCategoryId) {
      // Create a temporary transaction object for rule matching
      const tempTransaction = {
        id: 'temp',
        accountId: data.accountId,
        amount: new Decimal(data.amount),
        merchantName: data.merchantName || null,
        description: data.description,
        date: data.date,
        account: await prisma.account.findUnique({
          where: { id: data.accountId },
          select: { id: true, type: true, ownerId: true },
        }),
      };

      if (tempTransaction.account) {
        finalCategoryId = await applyRulesToTransaction(tempTransaction as any, householdId) || undefined;
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        accountId: data.accountId,
        date: data.date,
        amount: new Decimal(data.amount),
        description: data.description,
        merchantName: data.merchantName,
        categoryId: finalCategoryId,
        notes: data.notes,
        isManual: true,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            ownerId: true,
            owner: { select: { id: true, name: true } },
          },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    // Update account balance for manual transactions
    await prisma.account.update({
      where: { id: data.accountId },
      data: {
        currentBalance: {
          increment: new Decimal(data.amount),
        },
      },
    });

    res.status(201).json({ data: serializeTransaction(transaction) });
  } catch (err) {
    next(err);
  }
});

// Update transaction
transactionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateTransactionSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    const existing = await getHouseholdTransaction(req.params.id, householdId);

    // Verify category belongs to household (if changing)
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { householdId: true, isSystem: true },
      });

      if (!category) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
      }

      if (!category.isSystem && category.householdId !== householdId) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Category access denied', 403);
      }
    }

    // If amount is changing for a manual transaction, update account balance
    if (data.amount !== undefined && existing.isManual) {
      const amountDiff = data.amount - Number(existing.amount);
      if (amountDiff !== 0) {
        await prisma.account.update({
          where: { id: existing.accountId },
          data: {
            currentBalance: {
              increment: new Decimal(amountDiff),
            },
          },
        });
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        date: data.date,
        amount: data.amount !== undefined ? new Decimal(data.amount) : undefined,
        description: data.description,
        merchantName: data.merchantName,
        categoryId: data.categoryId,
        notes: data.notes,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            ownerId: true,
            owner: { select: { id: true, name: true } },
          },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: serializeTransaction(transaction) });
  } catch (err) {
    next(err);
  }
});

// Delete transaction (manual only)
transactionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const transaction = await getHouseholdTransaction(req.params.id, householdId);

    if (!transaction.isManual) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Only manual transactions can be deleted',
        400
      );
    }

    // Update account balance before deleting
    await prisma.account.update({
      where: { id: transaction.accountId },
      data: {
        currentBalance: {
          decrement: transaction.amount,
        },
      },
    });

    await prisma.transaction.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Transaction deleted' } });
  } catch (err) {
    next(err);
  }
});

// Bulk categorize transactions
transactionsRouter.post('/bulk-categorize', async (req, res, next) => {
  try {
    const schema = z.object({
      transactionIds: z.array(z.string()).min(1).max(100),
      categoryId: z.string().nullable(),
    });

    const data = schema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify all transactions belong to household
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        account: { householdId },
      },
      select: { id: true },
    });

    if (transactions.length !== data.transactionIds.length) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Some transactions not found or access denied',
        403
      );
    }

    // Verify category if provided
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { householdId: true, isSystem: true },
      });

      if (!category) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
      }

      if (!category.isSystem && category.householdId !== householdId) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Category access denied', 403);
      }
    }

    await prisma.transaction.updateMany({
      where: { id: { in: data.transactionIds } },
      data: { categoryId: data.categoryId },
    });

    res.json({
      data: {
        message: `${transactions.length} transactions updated`,
        count: transactions.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
