import { prisma } from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { RecurringFrequency, RecurringStatus } from '@prisma/client';

interface TransactionGroup {
  merchantName: string;
  transactions: {
    id: string;
    date: Date;
    amount: number;
    accountId: string;
    categoryId: string | null;
  }[];
}

interface DetectedPattern {
  merchantName: string;
  frequency: RecurringFrequency;
  expectedAmount: number;
  amountVariance: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextExpectedDate: Date;
  lastOccurrence: Date;
  accountId: string;
  categoryId: string | null;
  occurrenceCount: number;
  confidence: number;
  transactionIds: string[];
}

// Normalize merchant name for pattern matching
function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*#\d+/g, '') // Remove store numbers like "Store #123"
    .replace(/\s*\d{4,}/g, '') // Remove long numbers (order IDs, etc.)
    .replace(/\s*(inc|llc|corp|ltd|co|company)\.?$/i, '') // Remove company suffixes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Calculate the average interval between transactions in days
function calculateAverageInterval(dates: Date[]): number {
  if (dates.length < 2) return 0;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let totalInterval = 0;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    totalInterval += diff / (1000 * 60 * 60 * 24); // Convert to days
  }

  return totalInterval / (sortedDates.length - 1);
}

// Detect frequency from average interval
function detectFrequency(avgInterval: number): RecurringFrequency | null {
  if (avgInterval >= 5 && avgInterval <= 9) return 'WEEKLY';
  if (avgInterval >= 12 && avgInterval <= 16) return 'BIWEEKLY';
  if (avgInterval >= 26 && avgInterval <= 35) return 'MONTHLY';
  if (avgInterval >= 85 && avgInterval <= 100) return 'QUARTERLY';
  if (avgInterval >= 170 && avgInterval <= 195) return 'SEMIANNUAL';
  if (avgInterval >= 350 && avgInterval <= 380) return 'ANNUAL';
  return null;
}

// Calculate expected day based on frequency
function calculateExpectedDay(
  dates: Date[],
  frequency: RecurringFrequency
): { dayOfMonth: number | null; dayOfWeek: number | null } {
  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    // Calculate most common day of week
    const dayOfWeekCounts = new Map<number, number>();
    dates.forEach((date) => {
      const dow = date.getDay();
      dayOfWeekCounts.set(dow, (dayOfWeekCounts.get(dow) || 0) + 1);
    });

    let mostCommonDow = 0;
    let maxCount = 0;
    dayOfWeekCounts.forEach((count, dow) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDow = dow;
      }
    });

    return { dayOfMonth: null, dayOfWeek: mostCommonDow };
  } else {
    // Calculate most common day of month
    const dayOfMonthCounts = new Map<number, number>();
    dates.forEach((date) => {
      const dom = date.getDate();
      dayOfMonthCounts.set(dom, (dayOfMonthCounts.get(dom) || 0) + 1);
    });

    let mostCommonDom = 1;
    let maxCount = 0;
    dayOfMonthCounts.forEach((count, dom) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDom = dom;
      }
    });

    return { dayOfMonth: mostCommonDom, dayOfWeek: null };
  }
}

// Calculate next expected date based on last occurrence and frequency
function calculateNextExpectedDate(
  lastOccurrence: Date,
  frequency: RecurringFrequency,
  dayOfMonth: number | null,
  dayOfWeek: number | null
): Date {
  const next = new Date(lastOccurrence);

  switch (frequency) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'SEMIANNUAL':
      next.setMonth(next.getMonth() + 6);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'ANNUAL':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  // If next date is in the past, keep adding intervals until it's in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (next < today) {
    switch (frequency) {
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'SEMIANNUAL':
        next.setMonth(next.getMonth() + 6);
        break;
      case 'ANNUAL':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
  }

  return next;
}

// Calculate amount variance percentage
function calculateAmountVariance(amounts: number[]): number {
  if (amounts.length < 2) return 0;

  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  if (avg === 0) return 0;

  const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - avg)));
  return (maxDeviation / avg) * 100;
}

// Calculate confidence score based on pattern consistency
function calculateConfidence(
  occurrenceCount: number,
  intervalConsistency: number,
  amountConsistency: number
): number {
  // Base confidence from occurrence count (more = better)
  let confidence = Math.min(occurrenceCount / 6, 1) * 0.4; // Max 40% from count

  // Interval consistency (0-100% where 100% is perfect)
  confidence += (intervalConsistency / 100) * 0.4; // Max 40% from interval

  // Amount consistency (lower variance = better)
  const amountScore = Math.max(0, 1 - amountConsistency / 20); // 20% variance = 0 score
  confidence += amountScore * 0.2; // Max 20% from amount

  return Math.round(confidence * 100) / 100;
}

// Calculate interval consistency (how regular the intervals are)
function calculateIntervalConsistency(dates: Date[], expectedInterval: number): number {
  if (dates.length < 2) return 100;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let totalDeviation = 0;

  for (let i = 1; i < sortedDates.length; i++) {
    const interval = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    totalDeviation += Math.abs(interval - expectedInterval);
  }

  const avgDeviation = totalDeviation / (sortedDates.length - 1);
  const consistency = Math.max(0, 100 - (avgDeviation / expectedInterval) * 100);

  return consistency;
}

// Get expected interval for a frequency
function getExpectedInterval(frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'WEEKLY': return 7;
    case 'BIWEEKLY': return 14;
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 91;
    case 'SEMIANNUAL': return 182;
    case 'ANNUAL': return 365;
  }
}

export async function detectRecurringTransactions(householdId: string): Promise<{
  detected: number;
  updated: number;
  patterns: DetectedPattern[];
}> {
  // Fetch transactions from the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const transactions = await prisma.transaction.findMany({
    where: {
      account: {
        householdId,
      },
      date: {
        gte: twelveMonthsAgo,
      },
      isAdjustment: false,
      isPending: false,
      parentId: null, // Exclude split transactions
    },
    select: {
      id: true,
      date: true,
      amount: true,
      merchantName: true,
      description: true,
      accountId: true,
      categoryId: true,
    },
    orderBy: { date: 'desc' },
  });

  // Group by normalized merchant name
  const groups = new Map<string, TransactionGroup>();

  for (const tx of transactions) {
    const merchantKey = tx.merchantName
      ? normalizeMerchantName(tx.merchantName)
      : normalizeMerchantName(tx.description);

    if (!merchantKey || merchantKey.length < 3) continue;

    if (!groups.has(merchantKey)) {
      groups.set(merchantKey, {
        merchantName: merchantKey,
        transactions: [],
      });
    }

    groups.get(merchantKey)!.transactions.push({
      id: tx.id,
      date: tx.date,
      amount: Math.abs(Number(tx.amount)),
      accountId: tx.accountId,
      categoryId: tx.categoryId,
    });
  }

  // Detect patterns from groups with 3+ transactions
  const detectedPatterns: DetectedPattern[] = [];

  for (const [, group] of groups) {
    if (group.transactions.length < 3) continue;

    const dates = group.transactions.map((t) => t.date);
    const amounts = group.transactions.map((t) => t.amount);
    const avgInterval = calculateAverageInterval(dates);
    const frequency = detectFrequency(avgInterval);

    if (!frequency) continue;

    // Check amount consistency (should be within 10% variance typically)
    const amountVariance = calculateAmountVariance(amounts);
    if (amountVariance > 15) continue; // Skip if amounts vary too much

    const expectedAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const { dayOfMonth, dayOfWeek } = calculateExpectedDay(dates, frequency);

    // Get most recent transaction info
    const sortedTxs = [...group.transactions].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    const mostRecentTx = sortedTxs[0];

    const lastOccurrence = mostRecentTx.date;
    const nextExpectedDate = calculateNextExpectedDate(
      lastOccurrence,
      frequency,
      dayOfMonth,
      dayOfWeek
    );

    // Calculate confidence
    const intervalConsistency = calculateIntervalConsistency(
      dates,
      getExpectedInterval(frequency)
    );
    const confidence = calculateConfidence(
      group.transactions.length,
      intervalConsistency,
      amountVariance
    );

    // Only include patterns with confidence > 0.6
    if (confidence < 0.6) continue;

    detectedPatterns.push({
      merchantName: group.merchantName,
      frequency,
      expectedAmount: Math.round(expectedAmount * 100) / 100,
      amountVariance: Math.round(amountVariance * 100) / 100,
      dayOfMonth,
      dayOfWeek,
      nextExpectedDate,
      lastOccurrence,
      accountId: mostRecentTx.accountId,
      categoryId: mostRecentTx.categoryId,
      occurrenceCount: group.transactions.length,
      confidence,
      transactionIds: group.transactions.map((t) => t.id),
    });
  }

  // Save detected patterns to database
  let detected = 0;
  let updated = 0;

  for (const pattern of detectedPatterns) {
    try {
      const existing = await prisma.recurringTransaction.findUnique({
        where: {
          householdId_merchantName_frequency: {
            householdId,
            merchantName: pattern.merchantName,
            frequency: pattern.frequency,
          },
        },
      });

      if (existing) {
        // Update existing pattern if not manually created and not confirmed
        if (!existing.isManual && existing.status !== 'CONFIRMED') {
          await prisma.recurringTransaction.update({
            where: { id: existing.id },
            data: {
              expectedAmount: new Decimal(pattern.expectedAmount),
              amountVariance: new Decimal(pattern.amountVariance),
              dayOfMonth: pattern.dayOfMonth,
              dayOfWeek: pattern.dayOfWeek,
              nextExpectedDate: pattern.nextExpectedDate,
              lastOccurrence: pattern.lastOccurrence,
              accountId: pattern.accountId,
              categoryId: pattern.categoryId,
              occurrenceCount: pattern.occurrenceCount,
              confidence: new Decimal(pattern.confidence),
            },
          });
          updated++;
        }
      } else {
        // Create new pattern
        const created = await prisma.recurringTransaction.create({
          data: {
            householdId,
            merchantName: pattern.merchantName,
            frequency: pattern.frequency,
            expectedAmount: new Decimal(pattern.expectedAmount),
            amountVariance: new Decimal(pattern.amountVariance),
            dayOfMonth: pattern.dayOfMonth,
            dayOfWeek: pattern.dayOfWeek,
            nextExpectedDate: pattern.nextExpectedDate,
            lastOccurrence: pattern.lastOccurrence,
            accountId: pattern.accountId,
            categoryId: pattern.categoryId,
            status: 'DETECTED',
            isManual: false,
            occurrenceCount: pattern.occurrenceCount,
            confidence: new Decimal(pattern.confidence),
          },
        });

        // Link transactions to the recurring pattern
        for (const txId of pattern.transactionIds) {
          try {
            await prisma.transactionRecurringLink.create({
              data: {
                transactionId: txId,
                recurringTransactionId: created.id,
              },
            });
          } catch {
            // Transaction might already be linked to another pattern
          }
        }

        detected++;
      }
    } catch (err) {
      // Skip duplicates or other errors
      console.error(`Error saving pattern for ${pattern.merchantName}:`, err);
    }
  }

  return { detected, updated, patterns: detectedPatterns };
}

// Link a new transaction to an existing recurring pattern if it matches
export async function linkTransactionToRecurring(
  transactionId: string,
  householdId: string
): Promise<string | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      merchantName: true,
      description: true,
      amount: true,
      date: true,
    },
  });

  if (!transaction) return null;

  const merchantKey = transaction.merchantName
    ? normalizeMerchantName(transaction.merchantName)
    : normalizeMerchantName(transaction.description);

  if (!merchantKey) return null;

  // Find matching recurring pattern
  const recurringPatterns = await prisma.recurringTransaction.findMany({
    where: {
      householdId,
      merchantName: merchantKey,
      status: { in: ['DETECTED', 'CONFIRMED'] },
      isPaused: false,
    },
  });

  for (const pattern of recurringPatterns) {
    const amount = Math.abs(Number(transaction.amount));
    const expectedAmount = Number(pattern.expectedAmount);
    const variance = Number(pattern.amountVariance);

    // Check if amount is within variance
    const percentDiff = Math.abs(amount - expectedAmount) / expectedAmount * 100;
    if (percentDiff <= variance + 5) { // Allow a bit more tolerance
      // Link the transaction
      try {
        await prisma.transactionRecurringLink.create({
          data: {
            transactionId: transaction.id,
            recurringTransactionId: pattern.id,
          },
        });

        // Update the recurring pattern
        await prisma.recurringTransaction.update({
          where: { id: pattern.id },
          data: {
            lastOccurrence: transaction.date,
            occurrenceCount: { increment: 1 },
            nextExpectedDate: calculateNextExpectedDate(
              transaction.date,
              pattern.frequency,
              pattern.dayOfMonth,
              pattern.dayOfWeek
            ),
          },
        });

        return pattern.id;
      } catch {
        // Transaction might already be linked
      }
    }
  }

  return null;
}
