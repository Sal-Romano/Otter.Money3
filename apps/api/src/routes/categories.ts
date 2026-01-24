import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);
categoriesRouter.use(requireHousehold);

// List all categories (system + household custom)
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { householdId: null, isSystem: true }, // System defaults
          { householdId: req.user!.householdId! }, // Household custom
        ],
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

// TODO: Implement remaining operations
// POST / - Create category
// PATCH /:id - Update category
// DELETE /:id - Delete category
// POST /merge - Merge categories
