import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import { Decimal } from '@prisma/client/runtime/library';

export const goalsRouter = Router();

goalsRouter.use(authenticate);
goalsRouter.use(requireHousehold);

// Validation schemas
const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional().default(0),
  targetDate: z.string().datetime().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().datetime().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

const addFundsSchema = z.object({
  amount: z.number().positive(),
});

// Helper to calculate projected completion date
function calculateProjectedCompletion(
  currentAmount: number,
  targetAmount: number,
  createdAt: Date,
  contributions: { date: Date; amount: number }[]
): Date | null {
  if (currentAmount >= targetAmount) {
    return new Date(); // Already completed
  }

  if (contributions.length < 2) {
    return null; // Not enough data to project
  }

  // Calculate average contribution rate per day
  const sortedContributions = [...contributions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const firstContribution = sortedContributions[0];
  const lastContribution = sortedContributions[sortedContributions.length - 1];
  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);

  const daysDiff = Math.max(
    1,
    (lastContribution.date.getTime() - firstContribution.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dailyRate = totalContributed / daysDiff;

  if (dailyRate <= 0) {
    return null; // No progress being made
  }

  const remaining = targetAmount - currentAmount;
  const daysToComplete = remaining / dailyRate;

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToComplete));

  return projectedDate;
}

// Helper to transform goal for response
function transformGoal(goal: any) {
  return {
    id: goal.id,
    householdId: goal.householdId,
    name: goal.name,
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
    targetDate: goal.targetDate?.toISOString() || null,
    icon: goal.icon,
    color: goal.color,
    isCompleted: goal.isCompleted,
    completedAt: goal.completedAt?.toISOString() || null,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    // Computed fields
    percentComplete: goal.targetAmount > 0
      ? Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100)
      : 0,
    remaining: Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount)),
  };
}

// List all goals
goalsRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const includeCompleted = req.query.includeCompleted === 'true';

    const goals = await prisma.goal.findMany({
      where: {
        householdId,
        ...(includeCompleted ? {} : { isCompleted: false }),
      },
      orderBy: [
        { isCompleted: 'asc' },
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      data: goals.map(transformGoal),
    });
  } catch (err) {
    next(err);
  }
});

// Get single goal with details
goalsRouter.get('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    if (!goal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Goal not found', 404);
    }

    if (goal.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    res.json({ data: transformGoal(goal) });
  } catch (err) {
    next(err);
  }
});

// Create goal
goalsRouter.post('/', async (req, res, next) => {
  try {
    const data = createGoalSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    const goal = await prisma.goal.create({
      data: {
        householdId,
        name: data.name,
        targetAmount: new Decimal(data.targetAmount),
        currentAmount: new Decimal(data.currentAmount),
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        icon: data.icon || null,
        color: data.color || null,
        isCompleted: data.currentAmount >= data.targetAmount,
        completedAt: data.currentAmount >= data.targetAmount ? new Date() : null,
      },
    });

    res.status(201).json({ data: transformGoal(goal) });
  } catch (err) {
    next(err);
  }
});

// Update goal
goalsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateGoalSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify goal exists and belongs to household
    const existingGoal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    if (!existingGoal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Goal not found', 404);
    }

    if (existingGoal.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.targetAmount !== undefined) {
      updateData.targetAmount = new Decimal(data.targetAmount);
      // Check if goal is now complete with new target
      const currentAmount = Number(existingGoal.currentAmount);
      if (currentAmount >= data.targetAmount && !existingGoal.isCompleted) {
        updateData.isCompleted = true;
        updateData.completedAt = new Date();
      } else if (currentAmount < data.targetAmount && existingGoal.isCompleted) {
        // Goal is no longer complete if target increased
        updateData.isCompleted = false;
        updateData.completedAt = null;
      }
    }
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    }
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ data: transformGoal(goal) });
  } catch (err) {
    next(err);
  }
});

// Delete goal
goalsRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    // Verify goal exists and belongs to household
    const existingGoal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    if (!existingGoal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Goal not found', 404);
    }

    if (existingGoal.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    await prisma.goal.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Goal deleted' } });
  } catch (err) {
    next(err);
  }
});

// Add funds to goal
goalsRouter.post('/:id/add', async (req, res, next) => {
  try {
    const data = addFundsSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify goal exists and belongs to household
    const existingGoal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    if (!existingGoal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Goal not found', 404);
    }

    if (existingGoal.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const newAmount = Number(existingGoal.currentAmount) + data.amount;
    const targetAmount = Number(existingGoal.targetAmount);
    const isNowComplete = newAmount >= targetAmount;

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        currentAmount: new Decimal(newAmount),
        isCompleted: isNowComplete,
        completedAt: isNowComplete && !existingGoal.isCompleted ? new Date() : existingGoal.completedAt,
      },
    });

    res.json({
      data: {
        ...transformGoal(goal),
        amountAdded: data.amount,
        justCompleted: isNowComplete && !existingGoal.isCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Withdraw funds from goal
goalsRouter.post('/:id/withdraw', async (req, res, next) => {
  try {
    const data = addFundsSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify goal exists and belongs to household
    const existingGoal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    if (!existingGoal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Goal not found', 404);
    }

    if (existingGoal.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const newAmount = Math.max(0, Number(existingGoal.currentAmount) - data.amount);
    const targetAmount = Number(existingGoal.targetAmount);

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        currentAmount: new Decimal(newAmount),
        // If goal was completed but now isn't, reset completion status
        isCompleted: newAmount >= targetAmount,
        completedAt: newAmount >= targetAmount ? existingGoal.completedAt : null,
      },
    });

    res.json({
      data: {
        ...transformGoal(goal),
        amountWithdrawn: data.amount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get goal summary for dashboard
goalsRouter.get('/summary/dashboard', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const goals = await prisma.goal.findMany({
      where: {
        householdId,
        isCompleted: false,
      },
      orderBy: [
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 3,
    });

    const totalGoals = await prisma.goal.count({
      where: { householdId, isCompleted: false },
    });

    const completedThisMonth = await prisma.goal.count({
      where: {
        householdId,
        isCompleted: true,
        completedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    // Calculate total saved across all active goals
    const aggregation = await prisma.goal.aggregate({
      where: { householdId, isCompleted: false },
      _sum: {
        currentAmount: true,
        targetAmount: true,
      },
    });

    res.json({
      data: {
        goals: goals.map(transformGoal),
        totalActiveGoals: totalGoals,
        completedThisMonth,
        totalSaved: Number(aggregation._sum.currentAmount || 0),
        totalTarget: Number(aggregation._sum.targetAmount || 0),
        overallProgress: aggregation._sum.targetAmount
          ? (Number(aggregation._sum.currentAmount || 0) / Number(aggregation._sum.targetAmount)) * 100
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
