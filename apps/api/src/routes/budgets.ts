import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import { Decimal } from '@prisma/client/runtime/library';

export const budgetsRouter = Router();

budgetsRouter.use(authenticate);
budgetsRouter.use(requireHousehold);

// Validation schemas
const createBudgetSchema = z.object({
  categoryId: z.string(),
  amount: z.number().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  rollover: z.boolean().optional().default(false),
});

const updateBudgetSchema = z.object({
  amount: z.number().positive().optional(),
  rollover: z.boolean().optional(),
});

const copyBudgetSchema = z.object({
  fromPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  toPeriod: z.string().regex(/^\d{4}-\d{2}$/),
});

// Helper to get current period (YYYY-MM)
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to parse period into date range
function getPeriodDateRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// List budgets for a period
budgetsRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const period = (req.query.period as string) || getCurrentPeriod();

    const budgets = await prisma.budget.findMany({
      where: {
        householdId,
        period,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: {
        category: {
          name: 'asc',
        },
      },
    });

    // Transform to convert Decimal to number
    const result = budgets.map((budget) => ({
      id: budget.id,
      householdId: budget.householdId,
      categoryId: budget.categoryId,
      category: budget.category,
      amount: Number(budget.amount),
      period: budget.period,
      rollover: budget.rollover,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Get spending breakdown by category and partner for a period
budgetsRouter.get('/spending', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const period = (req.query.period as string) || getCurrentPeriod();
    const { start, end } = getPeriodDateRange(period);

    // Get all household members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Get all budgets for this period
    const budgets = await prisma.budget.findMany({
      where: {
        householdId,
        period,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    // Get all transactions in this period, grouped by category and account owner
    const transactions = await prisma.transaction.findMany({
      where: {
        account: {
          householdId,
          excludeFromBudget: false,
        },
        date: {
          gte: start,
          lte: end,
        },
        categoryId: {
          not: null,
        },
        isAdjustment: false,
        isPending: false,
      },
      include: {
        category: {
          select: {
            id: true,
            type: true,
          },
        },
        account: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    // Calculate spending by category and partner
    const spendingByCategory = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryType: string;
        categoryIcon: string | null;
        categoryColor: string | null;
        budgetAmount: number;
        totalSpent: number;
        byPartner: Record<string, number>;
      }
    >();

    // Initialize from budgets
    budgets.forEach((budget) => {
      const partnersMap: Record<string, number> = {};
      members.forEach((member) => {
        partnersMap[member.id] = 0;
      });

      spendingByCategory.set(budget.categoryId, {
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryType: budget.category.type,
        categoryIcon: budget.category.icon,
        categoryColor: budget.category.color,
        budgetAmount: Number(budget.amount),
        totalSpent: 0,
        byPartner: partnersMap,
      });
    });

    // Aggregate spending from transactions
    transactions.forEach((transaction) => {
      if (!transaction.categoryId || !transaction.category) return;

      // Only count expenses for budgets
      if (transaction.category.type !== 'EXPENSE') return;

      const categoryId = transaction.categoryId;
      const ownerId = transaction.account.ownerId;
      const amount = Math.abs(Number(transaction.amount));

      let categoryData = spendingByCategory.get(categoryId);

      // If category doesn't have a budget, skip it
      if (!categoryData) return;

      categoryData.totalSpent += amount;

      if (ownerId && categoryData.byPartner[ownerId] !== undefined) {
        categoryData.byPartner[ownerId] += amount;
      }
    });

    // Convert to array with partner details
    const result = Array.from(spendingByCategory.values()).map((data) => ({
      ...data,
      byPartner: members.map((member) => ({
        userId: member.id,
        userName: member.name,
        spent: data.byPartner[member.id] || 0,
      })),
      percentUsed: data.budgetAmount > 0 ? (data.totalSpent / data.budgetAmount) * 100 : 0,
      remaining: Math.max(0, data.budgetAmount - data.totalSpent),
      status:
        data.totalSpent > data.budgetAmount
          ? 'exceeded'
          : data.totalSpent >= data.budgetAmount * 0.9
          ? 'warning'
          : 'on-track',
    }));

    res.json({ data: result, period, members });
  } catch (err) {
    next(err);
  }
});

// Create or update budget
budgetsRouter.post('/', async (req, res, next) => {
  try {
    const data = createBudgetSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify category exists and is accessible
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { householdId: true, isSystem: true, type: true },
    });

    if (!category) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
    }

    if (!category.isSystem && category.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Category access denied', 403);
    }

    // Only allow budgets for expense categories
    if (category.type !== 'EXPENSE') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Budgets can only be created for expense categories',
        400
      );
    }

    // Upsert budget (create or update if exists)
    const budget = await prisma.budget.upsert({
      where: {
        householdId_categoryId_period: {
          householdId,
          categoryId: data.categoryId,
          period: data.period,
        },
      },
      update: {
        amount: new Decimal(data.amount),
        rollover: data.rollover,
      },
      create: {
        householdId,
        categoryId: data.categoryId,
        amount: new Decimal(data.amount),
        period: data.period,
        rollover: data.rollover,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    res.status(201).json({
      data: {
        id: budget.id,
        householdId: budget.householdId,
        categoryId: budget.categoryId,
        category: budget.category,
        amount: Number(budget.amount),
        period: budget.period,
        rollover: budget.rollover,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Update budget
budgetsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateBudgetSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify budget exists and belongs to household
    const existingBudget = await prisma.budget.findUnique({
      where: { id: req.params.id },
    });

    if (!existingBudget) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Budget not found', 404);
    }

    if (existingBudget.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const updateData: any = {};
    if (data.amount !== undefined) {
      updateData.amount = new Decimal(data.amount);
    }
    if (data.rollover !== undefined) {
      updateData.rollover = data.rollover;
    }

    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    res.json({
      data: {
        id: budget.id,
        householdId: budget.householdId,
        categoryId: budget.categoryId,
        category: budget.category,
        amount: Number(budget.amount),
        period: budget.period,
        rollover: budget.rollover,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Delete budget
budgetsRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    // Verify budget exists and belongs to household
    const existingBudget = await prisma.budget.findUnique({
      where: { id: req.params.id },
    });

    if (!existingBudget) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Budget not found', 404);
    }

    if (existingBudget.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    await prisma.budget.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Budget deleted' } });
  } catch (err) {
    next(err);
  }
});

// Copy budgets from one period to another
budgetsRouter.post('/copy', async (req, res, next) => {
  try {
    const data = copyBudgetSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    if (data.fromPeriod === data.toPeriod) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Source and target periods must be different',
        400
      );
    }

    // Get budgets from source period
    const sourceBudgets = await prisma.budget.findMany({
      where: {
        householdId,
        period: data.fromPeriod,
      },
    });

    if (sourceBudgets.length === 0) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        `No budgets found for period ${data.fromPeriod}`,
        404
      );
    }

    // Delete existing budgets in target period (if any)
    await prisma.budget.deleteMany({
      where: {
        householdId,
        period: data.toPeriod,
      },
    });

    // Create new budgets for target period
    const newBudgets = await prisma.budget.createMany({
      data: sourceBudgets.map((budget) => ({
        householdId,
        categoryId: budget.categoryId,
        amount: budget.amount,
        period: data.toPeriod,
        rollover: budget.rollover,
      })),
    });

    res.json({
      data: {
        message: `Copied ${newBudgets.count} budgets from ${data.fromPeriod} to ${data.toPeriod}`,
        count: newBudgets.count,
      },
    });
  } catch (err) {
    next(err);
  }
});
