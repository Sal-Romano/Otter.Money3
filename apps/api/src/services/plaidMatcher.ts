/**
 * Plaid transaction matcher service
 * Matches incoming Plaid transactions against existing account transactions
 * to provide a preview before syncing (similar to import matcher but for Plaid data)
 */

import { prisma } from '../utils/prisma';
import { normalizeTransactionAmount } from '../utils/plaid';
import { mapPlaidCategory, getCategoryIdByName } from '../utils/categoryMapping';
import type { ImportPreviewRow, ImportPreviewResponse, ImportFieldChange } from '@otter-money/shared';
import type { Transaction as PlaidTransaction } from 'plaid';

interface ExistingTransaction {
  id: string;
  externalId: string | null;
  date: Date;
  amount: number;
  description: string;
  merchantName: string | null;
  categoryId: string | null;
  accountId: string;
  isManual: boolean;
}

/**
 * Compute description similarity between two strings
 */
function descriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0;

  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = Math.min(normA.length, normB.length);
    const longer = Math.max(normA.length, normB.length);
    return shorter / longer;
  }

  const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * Compute similarity score between a Plaid transaction and an existing transaction
 */
function computeSimilarityScore(
  plaidTx: { date: Date; amount: number; description: string; merchant: string | null },
  existing: ExistingTransaction
): number {
  let score = 0;

  // Amount matching (0.40 max)
  const amountDiff = Math.abs(plaidTx.amount - existing.amount);
  if (amountDiff < 0.02) {
    score += 0.40;
  } else if (amountDiff < 0.50) {
    score += 0.20;
  }

  // Date matching (0.25 max)
  const daysDiff = Math.abs(
    Math.round((plaidTx.date.getTime() - existing.date.getTime()) / (1000 * 60 * 60 * 24))
  );
  if (daysDiff === 0) {
    score += 0.25;
  } else if (daysDiff <= 1) {
    score += 0.15;
  } else if (daysDiff <= 3) {
    score += 0.05;
  }

  // Description similarity (0.35 max)
  const descSim = Math.max(
    descriptionSimilarity(plaidTx.description, existing.description),
    descriptionSimilarity(plaidTx.merchant || '', existing.merchantName || ''),
    descriptionSimilarity(plaidTx.description, existing.merchantName || ''),
    descriptionSimilarity(plaidTx.merchant || '', existing.description)
  );
  score += descSim * 0.35;

  return score;
}

const MATCH_THRESHOLD = 0.70;

/**
 * Build a transaction preview for a set of Plaid transactions against an existing account.
 * Returns the same format as the import preview so we can reuse the UI.
 */
export async function buildPlaidTransactionPreview(
  plaidTransactions: PlaidTransaction[],
  targetAccountId: string,
  targetAccountName: string,
  householdId: string
): Promise<ImportPreviewResponse> {
  // Fetch existing transactions for the target account (within date range of incoming)
  const plaidDates = plaidTransactions.map((tx) => new Date(tx.date));
  if (plaidDates.length === 0) {
    return { totalRows: 0, summary: { create: 0, update: 0, skip: 0, unchanged: 0 }, rows: [] };
  }

  const minDate = new Date(Math.min(...plaidDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...plaidDates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 5);
  maxDate.setDate(maxDate.getDate() + 5);

  const rawTxs = await prisma.transaction.findMany({
    where: {
      accountId: targetAccountId,
      date: { gte: minDate, lte: maxDate },
    },
  });

  const existingTransactions: ExistingTransaction[] = rawTxs.map((tx) => ({
    id: tx.id,
    externalId: tx.externalId,
    date: tx.date,
    amount: Number(tx.amount),
    description: tx.description,
    merchantName: tx.merchantName,
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    isManual: tx.isManual,
  }));

  // Index existing by externalId
  const existingByExternalId = new Map<string, ExistingTransaction>();
  for (const tx of existingTransactions) {
    if (tx.externalId) existingByExternalId.set(tx.externalId, tx);
  }

  const matchedTxIds = new Set<string>();
  const previewRows: ImportPreviewRow[] = [];

  for (let i = 0; i < plaidTransactions.length; i++) {
    const plaidTx = plaidTransactions[i];
    const warnings: string[] = [];

    // Normalize amount
    const normalizedAmount = normalizeTransactionAmount(
      plaidTx.amount,
      plaidTx.name,
      plaidTx.personal_finance_category as any
    );

    const txDate = new Date(plaidTx.date);

    // Resolve category
    let categoryName: string | undefined;
    let categoryId: string | null = null;
    if (plaidTx.personal_finance_category) {
      const pfc = plaidTx.personal_finance_category as any;
      categoryName = mapPlaidCategory([pfc.primary, pfc.detailed]) || undefined;
      if (categoryName) {
        categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || null;
      }
    }

    // Try matching
    let matchedTx: ExistingTransaction | null = null;
    let matchConfidence: number | null = null;

    // Step 1: Exact match by externalId (transaction_id)
    const existing = existingByExternalId.get(plaidTx.transaction_id);
    if (existing && !matchedTxIds.has(existing.id)) {
      matchedTx = existing;
      matchConfidence = 1.0;
    }

    // Step 2: Fuzzy match
    if (!matchedTx) {
      let bestScore = 0;
      let bestCandidate: ExistingTransaction | null = null;

      for (const candidate of existingTransactions) {
        if (matchedTxIds.has(candidate.id)) continue;

        const score = computeSimilarityScore(
          { date: txDate, amount: normalizedAmount, description: plaidTx.name, merchant: plaidTx.merchant_name || null },
          candidate
        );

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate && bestScore >= MATCH_THRESHOLD) {
        matchedTx = bestCandidate;
        matchConfidence = Math.round(bestScore * 100) / 100;
      }
    }

    // Determine action
    let action: 'create' | 'update' | 'skip' | 'unchanged' = matchedTx ? 'update' : 'create';
    let changes: ImportFieldChange[] = [];

    if (matchedTx) {
      matchedTxIds.add(matchedTx.id);

      // Check what would change
      if (plaidTx.name && plaidTx.name !== matchedTx.description) {
        changes.push({ field: 'Description', from: matchedTx.description, to: plaidTx.name });
      }
      if (plaidTx.merchant_name && plaidTx.merchant_name !== (matchedTx.merchantName || '')) {
        changes.push({ field: 'Merchant', from: matchedTx.merchantName || '(none)', to: plaidTx.merchant_name });
      }
      if (Math.abs(normalizedAmount - matchedTx.amount) >= 0.01) {
        changes.push({ field: 'Amount', from: String(matchedTx.amount), to: String(normalizedAmount) });
      }

      if (changes.length === 0) {
        action = 'unchanged';
      }
    }

    if (plaidTx.pending) {
      warnings.push('Pending transaction — may change or be removed');
    }

    previewRows.push({
      rowNumber: i + 1,
      action,
      parsed: {
        date: txDate.toISOString().split('T')[0],
        amount: normalizedAmount,
        description: plaidTx.name,
        merchant: plaidTx.merchant_name || undefined,
        category: categoryName,
        categoryId,
        accountId: targetAccountId,
        accountName: targetAccountName,
      },
      matchedTransaction: matchedTx
        ? {
            id: matchedTx.id,
            date: matchedTx.date.toISOString().split('T')[0],
            amount: matchedTx.amount,
            description: matchedTx.description,
            merchantName: matchedTx.merchantName,
            categoryId: matchedTx.categoryId,
            isManual: matchedTx.isManual,
          }
        : null,
      matchConfidence,
      changes: changes.length > 0 ? changes : undefined,
      skipReason: null,
      warnings,
    });
  }

  const summary = { create: 0, update: 0, skip: 0, unchanged: 0 };
  for (const row of previewRows) {
    summary[row.action]++;
  }

  return {
    totalRows: plaidTransactions.length,
    summary,
    rows: previewRows,
  };
}
