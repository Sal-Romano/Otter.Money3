import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireHousehold } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { prisma } from '../utils/prisma';
import { ERROR_CODES } from '@otter-money/shared';
import type { RuleConditions, AccountType } from '@otter-money/shared';
import { applyRulesToTransaction } from '../services/ruleEngine';

export const rulesRouter = Router();

rulesRouter.use(authenticate);
rulesRouter.use(requireHousehold);

// Validation schemas
const conditionsSchema = z.object({
  merchantContains: z.string().min(1).max(200).optional(),
  descriptionContains: z.string().min(1).max(200).optional(),
  merchantExactly: z.string().min(1).max(200).optional(),
  descriptionExactly: z.string().min(1).max(200).optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
  amountExactly: z.number().optional(),
  accountIds: z.array(z.string()).optional(),
  accountTypes: z.array(z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT', 'LOAN', 'MORTGAGE', 'ASSET', 'OTHER'])).optional(),
  ownerIds: z.array(z.string()).optional(),
  operator: z.enum(['AND', 'OR']).optional(),
}).refine((data) => {
  // At least one condition must be specified
  return Object.keys(data).filter(k => k !== 'operator').length > 0;
}, {
  message: 'At least one condition must be specified',
});

const createRuleSchema = z.object({
  categoryId: z.string(),
  conditions: conditionsSchema,
  priority: z.number().int().min(-1000).max(1000).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
});

const updateRuleSchema = z.object({
  categoryId: z.string().optional(),
  conditions: conditionsSchema.optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  isEnabled: z.boolean().optional(),
});

// Helper to verify rule belongs to household
async function getHouseholdRule(ruleId: string, householdId: string) {
  const rule = await prisma.categorizationRule.findUnique({
    where: { id: ruleId },
    include: {
      category: {
        select: { id: true, name: true, type: true, icon: true, color: true },
      },
    },
  });

  if (!rule) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Rule not found', 404);
  }

  if (rule.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Access denied', 403);
  }

  return rule;
}

// Helper to verify category access
async function verifyCategoryAccess(categoryId: string, householdId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { householdId: true, isSystem: true },
  });

  if (!category) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
  }

  if (!category.isSystem && category.householdId !== householdId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Category access denied', 403);
  }
}

// Helper to validate account and owner IDs
async function validateConditionReferences(
  conditions: RuleConditions,
  householdId: string
) {
  // Validate account IDs
  if (conditions.accountIds && conditions.accountIds.length > 0) {
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: conditions.accountIds },
        householdId,
      },
      select: { id: true },
    });

    if (accounts.length !== conditions.accountIds.length) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Some account IDs are invalid or not accessible',
        400
      );
    }
  }

  // Validate owner IDs
  if (conditions.ownerIds && conditions.ownerIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: conditions.ownerIds },
        householdId,
      },
      select: { id: true },
    });

    if (users.length !== conditions.ownerIds.length) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Some owner IDs are invalid or not in household',
        400
      );
    }
  }

  // Validate amount range
  if (
    conditions.amountMin !== undefined &&
    conditions.amountMax !== undefined &&
    conditions.amountMin > conditions.amountMax
  ) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'amountMin must be less than or equal to amountMax',
      400
    );
  }
}

// List all rules
rulesRouter.get('/', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    const rules = await prisma.categorizationRule.findMany({
      where: { householdId },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: rules });
  } catch (err) {
    next(err);
  }
});

// Get single rule
rulesRouter.get('/:id', async (req, res, next) => {
  try {
    const rule = await getHouseholdRule(req.params.id, req.user!.householdId!);
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
});

// Create rule
rulesRouter.post('/', async (req, res, next) => {
  try {
    const data = createRuleSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify category access
    await verifyCategoryAccess(data.categoryId, householdId);

    // Validate condition references
    await validateConditionReferences(data.conditions, householdId);

    const rule = await prisma.categorizationRule.create({
      data: {
        householdId,
        categoryId: data.categoryId,
        conditions: data.conditions as any,
        priority: data.priority,
        isEnabled: data.isEnabled,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
});

// Update rule
rulesRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateRuleSchema.parse(req.body);
    const householdId = req.user!.householdId!;

    await getHouseholdRule(req.params.id, householdId);

    // Verify category access if changing
    if (data.categoryId) {
      await verifyCategoryAccess(data.categoryId, householdId);
    }

    // Validate condition references if changing
    if (data.conditions) {
      await validateConditionReferences(data.conditions, householdId);
    }

    const rule = await prisma.categorizationRule.update({
      where: { id: req.params.id },
      data: {
        categoryId: data.categoryId,
        conditions: data.conditions as any,
        priority: data.priority,
        isEnabled: data.isEnabled,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
});

// Delete rule
rulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    await getHouseholdRule(req.params.id, householdId);

    await prisma.categorizationRule.delete({
      where: { id: req.params.id },
    });

    res.json({ data: { message: 'Rule deleted' } });
  } catch (err) {
    next(err);
  }
});

// Test rule (preview matches without saving)
rulesRouter.post('/test', async (req, res, next) => {
  try {
    const schema = z.object({
      conditions: conditionsSchema,
      limit: z.number().int().min(1).max(100).optional().default(5),
    });

    const data = schema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Validate condition references
    await validateConditionReferences(data.conditions, householdId);

    // Build where clause based on conditions
    const where = buildWhereClause(data.conditions, householdId);

    const [matchingTransactions, totalMatches] = await Promise.all([
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
        orderBy: { date: 'desc' },
        take: data.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: {
        matchCount: totalMatches,
        sampleMatches: matchingTransactions.map((tx) => ({
          ...tx,
          amount: Number(tx.amount),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Apply rule retroactively
rulesRouter.post('/:id/apply', async (req, res, next) => {
  try {
    const { force = 'false' } = req.query;
    const householdId = req.user!.householdId!;
    const rule = await getHouseholdRule(req.params.id, householdId);

    if (!rule.isEnabled) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Cannot apply disabled rule',
        400
      );
    }

    // Build where clause
    const where = buildWhereClause(
      rule.conditions as RuleConditions,
      householdId
    );

    // Only apply to uncategorized transactions unless force=true
    if (force !== 'true') {
      where.categoryId = null;
    }

    // Update matching transactions
    const result = await prisma.transaction.updateMany({
      where,
      data: { categoryId: rule.categoryId },
    });

    res.json({
      data: {
        message: `Rule applied to ${result.count} transaction${result.count !== 1 ? 's' : ''}`,
        count: result.count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Apply all rules to specific transaction(s)
rulesRouter.post('/apply-to-transactions', async (req, res, next) => {
  try {
    const schema = z.object({
      transactionIds: z.array(z.string()).min(1).max(100),
    });

    const data = schema.parse(req.body);
    const householdId = req.user!.householdId!;

    // Verify transactions belong to household
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        account: { householdId },
      },
      include: {
        account: {
          select: { id: true, type: true, ownerId: true },
        },
      },
    });

    if (transactions.length !== data.transactionIds.length) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Some transactions not found or access denied',
        403
      );
    }

    // Apply rules to each transaction
    let categorizedCount = 0;
    for (const transaction of transactions) {
      const categoryId = await applyRulesToTransaction(transaction, householdId);
      if (categoryId && categoryId !== transaction.categoryId) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { categoryId },
        });
        categorizedCount++;
      }
    }

    res.json({
      data: {
        message: `Categorized ${categorizedCount} of ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`,
        categorizedCount,
        totalCount: transactions.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Helper function to build Prisma where clause from rule conditions
function buildWhereClause(conditions: RuleConditions, householdId: string): any {
  const where: any = {
    account: { householdId },
  };

  const operator = conditions.operator || 'AND';
  const criteriaList: any[] = [];

  // Text matching
  if (conditions.merchantContains) {
    criteriaList.push({
      merchantName: { contains: conditions.merchantContains, mode: 'insensitive' },
    });
  }

  if (conditions.descriptionContains) {
    criteriaList.push({
      description: { contains: conditions.descriptionContains, mode: 'insensitive' },
    });
  }

  if (conditions.merchantExactly) {
    criteriaList.push({
      merchantName: { equals: conditions.merchantExactly, mode: 'insensitive' },
    });
  }

  if (conditions.descriptionExactly) {
    criteriaList.push({
      description: { equals: conditions.descriptionExactly, mode: 'insensitive' },
    });
  }

  // Amount matching (uses absolute values so users think in dollar amounts)
  if (conditions.amountMin !== undefined || conditions.amountMax !== undefined) {
    const absMin = conditions.amountMin !== undefined ? Math.abs(conditions.amountMin) : undefined;
    const absMax = conditions.amountMax !== undefined ? Math.abs(conditions.amountMax) : undefined;

    // Match absolute value: |amount| >= min AND |amount| <= max
    // For max: |amount| <= max means amount is between -max and +max
    // For min: |amount| >= min means amount <= -min OR amount >= min
    if (absMax !== undefined && absMin !== undefined) {
      // Both min and max: amount in [-max, -min] OR [min, max]
      criteriaList.push({
        OR: [
          { amount: { gte: -absMax, lte: -absMin } },
          { amount: { gte: absMin, lte: absMax } },
        ],
      });
    } else if (absMax !== undefined) {
      // Only max: |amount| <= max means amount in [-max, max]
      criteriaList.push({ amount: { gte: -absMax, lte: absMax } });
    } else if (absMin !== undefined) {
      // Only min: |amount| >= min means amount <= -min OR amount >= min
      criteriaList.push({
        OR: [
          { amount: { lte: -absMin } },
          { amount: { gte: absMin } },
        ],
      });
    }
  }

  if (conditions.amountExactly !== undefined) {
    const absExact = Math.abs(conditions.amountExactly);
    criteriaList.push({
      OR: [
        { amount: absExact },
        { amount: -absExact },
      ],
    });
  }

  // Account filtering
  if (conditions.accountIds && conditions.accountIds.length > 0) {
    criteriaList.push({ accountId: { in: conditions.accountIds } });
  }

  if (conditions.accountTypes && conditions.accountTypes.length > 0) {
    criteriaList.push({ account: { type: { in: conditions.accountTypes } } });
  }

  // Owner filtering
  if (conditions.ownerIds && conditions.ownerIds.length > 0) {
    criteriaList.push({ account: { ownerId: { in: conditions.ownerIds } } });
  }

  // Apply operator
  if (criteriaList.length > 0) {
    if (operator === 'OR') {
      where.OR = criteriaList;
    } else {
      // AND - merge all criteria into where
      criteriaList.forEach((criteria) => {
        Object.assign(where, criteria);
      });
    }
  }

  return where;
}
