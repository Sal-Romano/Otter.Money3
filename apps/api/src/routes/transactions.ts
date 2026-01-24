import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const transactionsRouter = Router();

transactionsRouter.use(authenticate);
transactionsRouter.use(requireHousehold);

// List transactions with filters
transactionsRouter.get('/', async (req, res, next) => {
  try {
    const { accountId, categoryId, startDate, endDate, limit = '50', offset = '0' } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: {
        account: { householdId: req.user!.householdId! },
        ...(accountId && { accountId: String(accountId) }),
        ...(categoryId && { categoryId: String(categoryId) }),
        ...(startDate && { date: { gte: new Date(String(startDate)) } }),
        ...(endDate && { date: { lte: new Date(String(endDate)) } }),
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
      orderBy: { date: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json({ data: transactions });
  } catch (err) {
    next(err);
  }
});

// TODO: Implement remaining operations
// GET /:id - Get transaction
// PATCH /:id - Update transaction (category, notes)
// POST / - Create manual transaction
// DELETE /:id - Delete manual transaction
// POST /:id/split - Split transaction
