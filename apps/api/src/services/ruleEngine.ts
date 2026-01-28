import { prisma } from '../utils/prisma';
import type { RuleConditions } from '@otter-money/shared';
import type { Transaction, Account } from '@prisma/client';

interface TransactionWithAccount extends Transaction {
  account: Pick<Account, 'id' | 'type' | 'ownerId'>;
}

/**
 * Apply all enabled rules to a transaction and return the category ID
 * Returns null if no rules match
 */
export async function applyRulesToTransaction(
  transaction: TransactionWithAccount,
  householdId: string
): Promise<string | null> {
  // Get all enabled rules for this household, ordered by priority
  const rules = await prisma.categorizationRule.findMany({
    where: {
      householdId,
      isEnabled: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  // Try each rule until one matches
  for (const rule of rules) {
    const conditions = rule.conditions as RuleConditions;
    if (matchesRule(transaction, conditions)) {
      return rule.categoryId;
    }
  }

  return null;
}

/**
 * Check if a transaction matches a rule's conditions
 */
function matchesRule(
  transaction: TransactionWithAccount,
  conditions: RuleConditions
): boolean {
  const operator = conditions.operator || 'AND';
  const checks: boolean[] = [];

  // Text matching - merchant contains
  if (conditions.merchantContains !== undefined) {
    const merchantName = transaction.merchantName || '';
    checks.push(
      merchantName.toLowerCase().includes(conditions.merchantContains.toLowerCase())
    );
  }

  // Text matching - description contains
  if (conditions.descriptionContains !== undefined) {
    const description = transaction.description || '';
    checks.push(
      description.toLowerCase().includes(conditions.descriptionContains.toLowerCase())
    );
  }

  // Text matching - merchant exactly
  if (conditions.merchantExactly !== undefined) {
    const merchantName = transaction.merchantName || '';
    checks.push(
      merchantName.toLowerCase() === conditions.merchantExactly.toLowerCase()
    );
  }

  // Text matching - description exactly
  if (conditions.descriptionExactly !== undefined) {
    const description = transaction.description || '';
    checks.push(
      description.toLowerCase() === conditions.descriptionExactly.toLowerCase()
    );
  }

  // Amount matching - range
  const amount = Number(transaction.amount);
  if (conditions.amountMin !== undefined) {
    checks.push(amount >= conditions.amountMin);
  }

  if (conditions.amountMax !== undefined) {
    checks.push(amount <= conditions.amountMax);
  }

  // Amount matching - exactly
  if (conditions.amountExactly !== undefined) {
    checks.push(amount === conditions.amountExactly);
  }

  // Account filtering - specific accounts
  if (conditions.accountIds && conditions.accountIds.length > 0) {
    checks.push(conditions.accountIds.includes(transaction.accountId));
  }

  // Account filtering - account types
  if (conditions.accountTypes && conditions.accountTypes.length > 0) {
    checks.push(conditions.accountTypes.includes(transaction.account.type as any));
  }

  // Owner filtering
  if (conditions.ownerIds && conditions.ownerIds.length > 0) {
    const ownerId = transaction.account.ownerId;
    checks.push(ownerId !== null && conditions.ownerIds.includes(ownerId));
  }

  // Apply operator logic
  if (checks.length === 0) {
    return false; // No conditions = no match
  }

  if (operator === 'OR') {
    return checks.some((check) => check === true);
  } else {
    // AND
    return checks.every((check) => check === true);
  }
}

/**
 * Apply all rules to a batch of transactions
 * Returns a map of transaction ID to category ID
 */
export async function applyRulesToTransactions(
  transactions: TransactionWithAccount[],
  householdId: string
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();

  // Get all enabled rules once
  const rules = await prisma.categorizationRule.findMany({
    where: {
      householdId,
      isEnabled: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  // Apply rules to each transaction
  for (const transaction of transactions) {
    for (const rule of rules) {
      const conditions = rule.conditions as RuleConditions;
      if (matchesRule(transaction, conditions)) {
        categoryMap.set(transaction.id, rule.categoryId);
        break; // First match wins
      }
    }
  }

  return categoryMap;
}

/**
 * Apply rules to uncategorized transactions in the household
 * Returns the number of transactions categorized
 */
export async function categorizeUncategorizedTransactions(
  householdId: string
): Promise<number> {
  // Get all uncategorized transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      account: { householdId },
      categoryId: null,
    },
    include: {
      account: {
        select: { id: true, type: true, ownerId: true },
      },
    },
  });

  if (transactions.length === 0) {
    return 0;
  }

  // Apply rules
  const categoryMap = await applyRulesToTransactions(transactions, householdId);

  // Update transactions in batches
  let categorizedCount = 0;
  for (const [transactionId, categoryId] of categoryMap.entries()) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
    });
    categorizedCount++;
  }

  return categorizedCount;
}
