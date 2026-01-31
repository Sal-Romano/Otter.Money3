import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { detectRecurringTransactions, linkTransactionToRecurring } from '../services/recurringDetection';

export const recurringRouter = Router();

recurringRouter.use(authenticate);
recurringRouter.use(requireHousehold);

// Validation schemas
const createRecurringSchema = z.object({
  merchantName: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  expectedAmount: z.number().positive(),
  amountVariance: z.number().min(0).max(100).optional().default(5),
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  nextExpectedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

const updateRecurringSchema = z.object({
  merchantName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional(),
  expectedAmount: z.number().positive().optional(),
  amountVariance: z.number().min(0).max(100).optional(),
  dayOfMonth: z.number().min(1).max(31).nullable().optional(),
  dayOfWeek: z.number().min(0).max(6).nullable().optional(),
  nextExpectedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const markRecurringSchema = z.object({
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  expectedAmount: z.number().positive().optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
});

// Helper to convert Prisma recurring to API format
function formatRecurring(recurring: any) {
  return {
    id: recurring.id,
    householdId: recurring.householdId,
    merchantName: recurring.merchantName,
    description: recurring.description,
    frequency: recurring.frequency,
    expectedAmount: Number(recurring.expectedAmount),
    amountVariance: Number(recurring.amountVariance),
    dayOfMonth: recurring.dayOfMonth,
    dayOfWeek: recurring.dayOfWeek,
    nextExpectedDate: recurring.nextExpectedDate,
    lastOccurrence: recurring.lastOccurrence,
    accountId: recurring.accountId,
    categoryId: recurring.categoryId,
    status: recurring.status,
    isManual: recurring.isManual,
    isPaused: recurring.isPaused,
    occurrenceCount: recurring.occurrenceCount,
    confidence: Number(recurring.confidence),
    notes: recurring.notes,
    createdAt: recurring.createdAt,
    updatedAt: recurring.updatedAt,
    account: recurring.account ? {
      id: recurring.account.id,
      name: recurring.account.name,
      type: recurring.account.type,
      ownerId: recurring.account.ownerId,
    } : null,
    category: recurring.category ? {
      id: recurring.category.id,
      name: recurring.category.name,
      type: recurring.category.type,
      icon: recurring.category.icon,
      color: recurring.category.color,
    } : null,
  };
}

// List recurring transactions with optional status filter
recurringRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const status = req.query.status as string | undefined;
    const isPaused = req.query.isPaused === 'true' ? true : req.query.isPaused === 'false' ? false : undefined;

    const where: any = { householdId };
    if (status) {
      where.status = status;
    }
    if (isPaused !== undefined) {
      where.isPaused = isPaused;
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where,
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // DETECTED first
        { nextExpectedDate: 'asc' },
      ],
    });

    res.json({ data: recurring.map(formatRecurring) });
  } catch (err) {
    next(err);
  }
});

// Get upcoming bills (next N days)
recurringRouter.get('/upcoming', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 5;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = await prisma.recurringTransaction.findMany({
      where: {
        householdId,
        status: { in: ['DETECTED', 'CONFIRMED'] },
        isPaused: false,
        nextExpectedDate: {
          lte: endDate,
        },
      },
      include: {
        account: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { nextExpectedDate: 'asc' },
      take: limit,
    });

    const bills = upcoming.map((r) => {
      const nextDate = new Date(r.nextExpectedDate);
      const daysUntilDue = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        merchantName: r.merchantName,
        expectedAmount: Number(r.expectedAmount),
        nextExpectedDate: r.nextExpectedDate,
        frequency: r.frequency,
        status: r.status,
        categoryId: r.categoryId,
        categoryName: r.category?.name || null,
        categoryColor: r.category?.color || null,
        accountId: r.accountId,
        accountName: r.account?.name || null,
        isPaused: r.isPaused,
        daysUntilDue,
      };
    });

    res.json({ data: bills });
  } catch (err) {
    next(err);
  }
});

// Get single recurring transaction with linked transactions
recurringRouter.get('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const recurring = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
        transactions: {
          include: {
            transaction: {
              select: {
                id: true,
                date: true,
                amount: true,
                merchantName: true,
                description: true,
              },
            },
          },
          orderBy: {
            transaction: { date: 'desc' },
          },
          take: 10,
        },
      },
    });

    if (!recurring) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (recurring.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const result = {
      ...formatRecurring(recurring),
      linkedTransactions: recurring.transactions.map((link) => ({
        id: link.transaction.id,
        date: link.transaction.date,
        amount: Number(link.transaction.amount),
        merchantName: link.transaction.merchantName,
        description: link.transaction.description,
      })),
    };

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Create manual recurring transaction
recurringRouter.post('/', async (req, res, next) => {
  try {
    const data = createRecurringSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify account belongs to household if provided
    if (data.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: data.accountId },
        select: { householdId: true },
      });
      if (!account || account.householdId !== householdId) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Account access denied', 403);
      }
    }

    // Verify category is accessible if provided
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

    const recurring = await prisma.recurringTransaction.create({
      data: {
        householdId,
        merchantName: data.merchantName.toLowerCase().trim(),
        description: data.description,
        frequency: data.frequency,
        expectedAmount: new Decimal(data.expectedAmount),
        amountVariance: new Decimal(data.amountVariance),
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        nextExpectedDate: new Date(data.nextExpectedDate),
        accountId: data.accountId,
        categoryId: data.categoryId,
        status: 'CONFIRMED', // Manual entries are auto-confirmed
        isManual: true,
        notes: data.notes,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.status(201).json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Update recurring transaction
recurringRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateRecurringSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify exists and belongs to household
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const updateData: any = {};

    if (data.merchantName !== undefined) {
      updateData.merchantName = data.merchantName.toLowerCase().trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.frequency !== undefined) {
      updateData.frequency = data.frequency;
    }
    if (data.expectedAmount !== undefined) {
      updateData.expectedAmount = new Decimal(data.expectedAmount);
    }
    if (data.amountVariance !== undefined) {
      updateData.amountVariance = new Decimal(data.amountVariance);
    }
    if (data.dayOfMonth !== undefined) {
      updateData.dayOfMonth = data.dayOfMonth;
    }
    if (data.dayOfWeek !== undefined) {
      updateData.dayOfWeek = data.dayOfWeek;
    }
    if (data.nextExpectedDate !== undefined) {
      updateData.nextExpectedDate = new Date(data.nextExpectedDate);
    }
    if (data.accountId !== undefined) {
      updateData.accountId = data.accountId;
    }
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Delete recurring transaction
recurringRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    // Delete links first (cascade should handle this but being explicit)
    await prisma.transactionRecurringLink.deleteMany({
      where: { recurringTransactionId: req.params.id },
    });

    await prisma.recurringTransaction.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Recurring transaction deleted' } });
  } catch (err) {
    next(err);
  }
});

// Confirm detected recurring transaction
recurringRouter.post('/:id/confirm', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Dismiss detected recurring transaction
recurringRouter.post('/:id/dismiss', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { status: 'DISMISSED' },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Pause recurring transaction
recurringRouter.post('/:id/pause', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { isPaused: true },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Resume paused recurring transaction
recurringRouter.post('/:id/resume', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { isPaused: false },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Mark recurring as ended
recurringRouter.post('/:id/end', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Recurring transaction not found', 404);
    }

    if (existing.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: { status: 'ENDED' },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});

// Run detection algorithm
recurringRouter.post('/detect', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const result = await detectRecurringTransactions(householdId);

    res.json({
      data: {
        detected: result.detected,
        updated: result.updated,
        message: `Detected ${result.detected} new recurring patterns, updated ${result.updated} existing`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Mark a transaction as recurring (create from transaction)
recurringRouter.post('/from-transaction/:transactionId', async (req, res, next) => {
  try {
    const data = markRecurringSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Get the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.transactionId },
      include: {
        account: {
          select: { id: true, householdId: true },
        },
      },
    });

    if (!transaction) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Transaction not found', 404);
    }

    if (transaction.account.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const merchantName = (transaction.merchantName || transaction.description).toLowerCase().trim();
    const expectedAmount = data.expectedAmount || Math.abs(Number(transaction.amount));

    // Calculate next expected date based on frequency
    const nextExpectedDate = new Date(transaction.date);
    switch (data.frequency) {
      case 'WEEKLY':
        nextExpectedDate.setDate(nextExpectedDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        nextExpectedDate.setDate(nextExpectedDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 3);
        break;
      case 'SEMIANNUAL':
        nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 6);
        break;
      case 'ANNUAL':
        nextExpectedDate.setFullYear(nextExpectedDate.getFullYear() + 1);
        break;
    }

    // Create or update recurring pattern
    const recurring = await prisma.recurringTransaction.upsert({
      where: {
        householdId_merchantName_frequency: {
          householdId,
          merchantName,
          frequency: data.frequency,
        },
      },
      update: {
        expectedAmount: new Decimal(expectedAmount),
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        lastOccurrence: transaction.date,
        nextExpectedDate,
        occurrenceCount: { increment: 1 },
        status: 'CONFIRMED',
      },
      create: {
        householdId,
        merchantName,
        frequency: data.frequency,
        expectedAmount: new Decimal(expectedAmount),
        dayOfMonth: data.dayOfMonth,
        dayOfWeek: data.dayOfWeek,
        nextExpectedDate,
        lastOccurrence: transaction.date,
        accountId: transaction.account.id,
        categoryId: transaction.categoryId,
        status: 'CONFIRMED',
        isManual: true,
        occurrenceCount: 1,
        confidence: new Decimal(1.00),
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    // Link the transaction
    try {
      await prisma.transactionRecurringLink.create({
        data: {
          transactionId: transaction.id,
          recurringTransactionId: recurring.id,
        },
      });
    } catch {
      // Transaction might already be linked
    }

    res.status(201).json({ data: formatRecurring(recurring) });
  } catch (err) {
    next(err);
  }
});
