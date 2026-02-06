import { Router } from 'express';
import { z } from 'zod';
import { CategoryType } from '@prisma/client';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES, DEFAULT_CATEGORIES_HIERARCHICAL, HierarchicalCategory } from '@otter-money/shared';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);
categoriesRouter.use(requireHousehold);

// Maximum nesting depth (0=root, 1=child, 2=grandchild = 3 levels total)
const MAX_DEPTH = 2;

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

// Types for tree structure
interface CategoryWithChildren {
  id: string;
  householdId: string | null;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  isSystem: boolean;
  depth: number;
  displayOrder: number;
  transactionCount: number;
  children: CategoryWithChildren[];
}

// Helper to verify category is accessible (system or household-owned)
async function getAccessibleCategory(categoryId: string, householdId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
  }

  // System categories are accessible to all
  if (category.isSystem) {
    return category;
  }

  // Household categories must belong to user's household
  if (category.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }

  return category;
}

// Helper to count transactions in a category and all its descendants
async function countCategoryTransactions(categoryId: string): Promise<{ direct: number; nested: number; childrenWithTransactions: string[] }> {
  const directCount = await prisma.transaction.count({
    where: { categoryId },
  });

  const descendants = await getCategoryDescendants(categoryId);
  let nestedCount = 0;
  const childrenWithTransactions: string[] = [];

  for (const descId of descendants) {
    const count = await prisma.transaction.count({
      where: { categoryId: descId },
    });
    if (count > 0) {
      nestedCount += count;
      const child = await prisma.category.findUnique({
        where: { id: descId },
        select: { name: true },
      });
      if (child) childrenWithTransactions.push(child.name);
    }
  }

  return { direct: directCount, nested: nestedCount, childrenWithTransactions };
}

// Helper to build category tree from flat list
function buildCategoryTree(categories: any[]): CategoryWithChildren[] {
  const categoryMap = new Map<string, CategoryWithChildren>();
  const roots: CategoryWithChildren[] = [];

  // First pass: create all nodes
  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      id: cat.id,
      householdId: cat.householdId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      parentId: cat.parentId,
      isSystem: cat.isSystem,
      depth: cat.depth,
      displayOrder: cat.displayOrder,
      transactionCount: cat._count?.transactions || 0,
      children: [],
    });
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else if (!cat.parentId) {
      roots.push(node);
    }
  });

  // Sort children by displayOrder, then name
  const sortChildren = (nodes: CategoryWithChildren[]) => {
    nodes.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);
  return roots;
}

// Helper to get all descendant category IDs
async function getCategoryDescendants(categoryId: string): Promise<string[]> {
  const descendants: string[] = [];

  const getChildren = async (parentId: string) => {
    const children = await prisma.category.findMany({
      where: { parentId },
      select: { id: true },
    });

    for (const child of children) {
      descendants.push(child.id);
      await getChildren(child.id);
    }
  };

  await getChildren(categoryId);
  return descendants;
}

// List all categories (system + household custom) - flat list
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { householdId: null, isSystem: true }, // System defaults
          { householdId }, // Household custom
        ],
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ type: 'asc' }, { depth: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });

    // Transform to include transaction count and new fields
    const result = categories.map((cat) => ({
      id: cat.id,
      householdId: cat.householdId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      parentId: cat.parentId,
      isSystem: cat.isSystem,
      depth: cat.depth,
      displayOrder: cat.displayOrder,
      transactionCount: cat._count.transactions,
    }));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Get categories as tree structure
categoriesRouter.get('/tree', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { householdId: null, isSystem: true },
          { householdId },
        ],
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ type: 'asc' }, { depth: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });

    const tree = buildCategoryTree(categories);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

// Get all descendant IDs for a category (useful for budget aggregation)
categoriesRouter.get('/:id/descendants', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const categoryId = req.params.id;

    // Verify category exists and is accessible
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { householdId: true, isSystem: true },
    });

    if (!category) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
    }

    if (!category.isSystem && category.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
    }

    const descendants = await getCategoryDescendants(categoryId);
    res.json({ data: { categoryId, descendants } });
  } catch (err) {
    next(err);
  }
});

// Create custom category
categoriesRouter.post('/', async (req, res, next) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Check for duplicate name in household
    const existing = await prisma.category.findFirst({
      where: {
        OR: [
          { householdId, name: data.name },
          { householdId: null, isSystem: true, name: data.name },
        ],
      },
    });

    if (existing) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'A category with this name already exists',
        409
      );
    }

    let depth = 0;
    let displayOrder = 0;

    // Verify parent category if provided
    if (data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentId },
        select: { householdId: true, isSystem: true, type: true, depth: true },
      });

      if (!parent) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Parent category not found', 404);
      }

      if (!parent.isSystem && parent.householdId !== householdId) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Parent category access denied', 403);
      }

      // Parent and child must have same type
      if (parent.type !== data.type) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Child category must have same type as parent',
          400
        );
      }

      // Check depth limit (max 3 levels = depth 2)
      if (parent.depth >= MAX_DEPTH) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Maximum category depth is ${MAX_DEPTH + 1} levels`,
          400
        );
      }

      depth = parent.depth + 1;

      // Get max displayOrder among siblings
      const maxOrder = await prisma.category.aggregate({
        where: { parentId: data.parentId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder || 0) + 1;
    } else {
      // Root category - get max displayOrder among roots of same type
      const maxOrder = await prisma.category.aggregate({
        where: {
          parentId: null,
          type: data.type,
          OR: [
            { householdId },
            { householdId: null, isSystem: true },
          ],
        },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder || 0) + 1;
    }

    const category = await prisma.category.create({
      data: {
        householdId,
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: data.color,
        parentId: data.parentId,
        depth,
        displayOrder,
        isSystem: false,
      },
    });

    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
});

// Update category (system or custom)
categoriesRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateCategorySchema.parse(req.body);
    const householdId = req.user!.householdId!;

    await getAccessibleCategory(req.params.id, householdId);

    // Check for duplicate name if changing
    if (data.name) {
      const existing = await prisma.category.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [
            { householdId, name: data.name },
            { householdId: null, isSystem: true, name: data.name },
          ],
        },
      });

      if (existing) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'A category with this name already exists',
          409
        );
      }
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
      },
    });

    res.json({ data: category });
  } catch (err) {
    next(err);
  }
});

// Check category deletion impact (called before delete to show user options)
categoriesRouter.get('/:id/deletion-impact', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    await getAccessibleCategory(req.params.id, householdId);

    const { direct, nested, childrenWithTransactions } = await countCategoryTransactions(req.params.id);

    // Check if category has children
    const childCount = await prisma.category.count({
      where: { parentId: req.params.id },
    });

    res.json({
      data: {
        categoryId: req.params.id,
        directTransactions: direct,
        nestedTransactions: nested,
        childrenWithTransactions,
        childCategoryCount: childCount,
        canDelete: nested === 0, // Can only delete if no nested transactions
      },
    });
  } catch (err) {
    next(err);
  }
});

// Delete category (system or custom)
categoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    await getAccessibleCategory(req.params.id, householdId);

    // Parse action from query params
    const action = req.query.action as string | undefined; // 'unassign' | 'reassign'
    const targetCategoryId = req.query.targetCategoryId as string | undefined;

    // Count transactions
    const { direct, nested, childrenWithTransactions } = await countCategoryTransactions(req.params.id);

    // Check if category has children with transactions - must resolve those first
    if (nested > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `This category has subcategories with ${nested} transactions (${childrenWithTransactions.join(', ')}). Please delete or reassign those subcategories first before deleting this parent category.`,
        409
      );
    }

    // Check if category has children (even without transactions)
    const childCount = await prisma.category.count({
      where: { parentId: req.params.id },
    });

    if (childCount > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `This category has ${childCount} subcategories. Please delete or move them first.`,
        409
      );
    }

    // Handle transactions on this category
    if (direct > 0) {
      if (!action) {
        // Return info about what needs to be done
        throw new AppError(
          ERROR_CODES.CONFLICT,
          `This category has ${direct} transactions. Choose to unassign them (remove category) or reassign them to another category.`,
          409
        );
      }

      if (action === 'reassign') {
        if (!targetCategoryId) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            'Target category ID is required when reassigning transactions',
            400
          );
        }

        // Verify target category exists and is accessible
        const target = await getAccessibleCategory(targetCategoryId, householdId);

        // Get source category type
        const source = await prisma.category.findUnique({
          where: { id: req.params.id },
          select: { type: true },
        });

        if (source && target.type !== source.type) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            'Can only reassign to a category of the same type',
            400
          );
        }

        // Reassign transactions
        await prisma.transaction.updateMany({
          where: { categoryId: req.params.id },
          data: { categoryId: targetCategoryId },
        });
      } else if (action === 'unassign') {
        // Remove category from transactions
        await prisma.transaction.updateMany({
          where: { categoryId: req.params.id },
          data: { categoryId: null },
        });
      } else {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid action. Use "unassign" or "reassign".',
          400
        );
      }
    }

    // Also delete any rules using this category
    await prisma.categorizationRule.deleteMany({
      where: { categoryId: req.params.id },
    });

    // Delete any budgets for this category
    await prisma.budget.deleteMany({
      where: { categoryId: req.params.id },
    });

    // Now delete the category
    await prisma.category.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Category deleted', transactionsAffected: direct } });
  } catch (err) {
    next(err);
  }
});

// Merge categories (move all transactions from source to target, then delete source)
categoriesRouter.post('/merge', async (req, res, next) => {
  try {
    const schema = z.object({
      sourceId: z.string(),
      targetId: z.string(),
    });

    const data = schema.parse(req.body);
    const householdId = req.user!.householdId!;

    if (data.sourceId === data.targetId) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Source and target categories must be different',
        400
      );
    }

    // Verify source category is accessible
    const source = await getAccessibleCategory(data.sourceId, householdId);

    // Verify target exists and is accessible
    const target = await prisma.category.findUnique({
      where: { id: data.targetId },
      select: { householdId: true, isSystem: true, type: true },
    });

    if (!target) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Target category not found', 404);
    }

    if (!target.isSystem && target.householdId !== householdId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Target category access denied', 403);
    }

    // Categories must be same type
    if (source.type !== target.type) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Can only merge categories of the same type',
        400
      );
    }

    // Check if source has children - if so, we need to handle them
    const childCount = await prisma.category.count({
      where: { parentId: data.sourceId },
    });

    if (childCount > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `Cannot merge category with ${childCount} subcategories. Delete or move subcategories first.`,
        409
      );
    }

    // Move transactions and delete source
    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { categoryId: data.sourceId },
        data: { categoryId: data.targetId },
      }),
      prisma.category.delete({
        where: { id: data.sourceId },
      }),
    ]);

    res.json({ data: { message: 'Categories merged successfully' } });
  } catch (err) {
    next(err);
  }
});

// Restore default categories (re-creates missing system categories by name)
categoriesRouter.post('/restore-defaults', async (req, res, next) => {
  try {
    const restored: string[] = [];

    // Helper to restore category tree recursively
    async function restoreCategoryTree(
      categories: HierarchicalCategory[],
      type: CategoryType,
      parentId: string | null,
      depth: number,
      startingOrder: number = 0
    ): Promise<number> {
      let displayOrder = startingOrder;

      for (const cat of categories) {
        // Check if category exists by name and type
        const existing = await prisma.category.findFirst({
          where: {
            name: cat.name,
            type: type,
            isSystem: true,
            householdId: null,
          },
        });

        let categoryId: string;

        if (!existing) {
          // Create the missing category
          const created = await prisma.category.create({
            data: {
              name: cat.name,
              type,
              icon: cat.icon,
              color: cat.color || null,
              parentId,
              depth,
              displayOrder,
              isSystem: true,
              householdId: null,
            },
          });
          categoryId = created.id;
          restored.push(cat.name);
        } else {
          categoryId = existing.id;
        }

        displayOrder++;

        // Restore children recursively
        if (cat.children && cat.children.length > 0) {
          await restoreCategoryTree(cat.children, type, categoryId, depth + 1, 0);
        }
      }

      return displayOrder;
    }

    // Restore for each type
    for (const type of ['EXPENSE', 'INCOME', 'TRANSFER'] as CategoryType[]) {
      const categories = DEFAULT_CATEGORIES_HIERARCHICAL[type];
      if (categories && categories.length > 0) {
        await restoreCategoryTree(categories, type, null, 0);
      }
    }

    res.json({
      data: {
        message: restored.length > 0
          ? `Restored ${restored.length} categories: ${restored.join(', ')}`
          : 'All default categories already exist',
        restored,
      },
    });
  } catch (err) {
    next(err);
  }
});
