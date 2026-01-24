import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const accountsRouter = Router();

accountsRouter.use(authenticate);
accountsRouter.use(requireHousehold);

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
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    });

    res.json({ data: accounts });
  } catch (err) {
    next(err);
  }
});

// TODO: Implement remaining CRUD operations
// POST / - Create account
// GET /:id - Get account
// PATCH /:id - Update account
// DELETE /:id - Delete account
// POST /:id/balance - Update balance
