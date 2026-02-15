/**
 * Import matcher service
 * Handles deduplication, validation, and execution of CSV transaction imports
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { parseCSV, normalizeColumnName, parseDate, parseAmount, resolveAmountSign } from '../utils/csvParser';
import { getCategoryIdByName } from '../utils/categoryMapping';
import { applyRulesToTransaction } from './ruleEngine';
import type { ImportPreviewRow, ImportPreviewResponse, ImportExecuteResponse, ImportFieldChange } from '@otter-money/shared';

interface ParsedImportRow {
  rowNumber: number;
  id?: string;
  externalId?: string;
  date: Date | null;
  amount: number | null;
  description: string;
  merchant: string;
  categoryName: string;
  accountName: string;
  notes: string;
  type?: string;
  isManual?: boolean;
}

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
  notes: string | null;
  account: { id: string; type: string; ownerId: string | null };
}

/**
 * Compute description similarity between two strings
 * Uses normalized containment — checks if significant parts of one string appear in the other
 */
function descriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Check containment in both directions
  if (normA.includes(normB) || normB.includes(normA)) {
    const shorter = Math.min(normA.length, normB.length);
    const longer = Math.max(normA.length, normB.length);
    return shorter / longer;
  }

  // Word overlap
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
 * Compute a similarity score between a parsed import row and an existing transaction
 */
function computeSimilarityScore(
  row: { date: Date; amount: number; description: string; merchant: string },
  existing: ExistingTransaction
): number {
  let score = 0;

  // Amount matching (0.40 max)
  const amountDiff = Math.abs(row.amount - existing.amount);
  if (amountDiff < 0.02) {
    score += 0.40;
  } else if (amountDiff < 0.50) {
    score += 0.20;
  }

  // Date matching (0.25 max)
  const daysDiff = Math.abs(
    Math.round((row.date.getTime() - existing.date.getTime()) / (1000 * 60 * 60 * 24))
  );
  if (daysDiff === 0) {
    score += 0.25;
  } else if (daysDiff <= 1) {
    score += 0.15;
  } else if (daysDiff <= 3) {
    score += 0.05;
  }

  // Description similarity (0.35 max)
  // Compare against both description and merchant name
  const descSim = Math.max(
    descriptionSimilarity(row.description, existing.description),
    descriptionSimilarity(row.merchant, existing.merchantName || ''),
    descriptionSimilarity(row.description, existing.merchantName || ''),
    descriptionSimilarity(row.merchant, existing.description)
  );
  score += descSim * 0.35;

  return score;
}

const MATCH_THRESHOLD = 0.70;

/**
 * Parse raw CSV rows into structured import rows
 */
function parseImportRows(csvContent: string): ParsedImportRow[] {
  const { headers, rows } = parseCSV(csvContent);

  if (headers.length === 0) {
    throw new Error('CSV file is empty or has no header row');
  }

  // Map headers to normalized names
  const headerMap: Record<string, string> = {};
  for (const h of headers) {
    headerMap[h] = normalizeColumnName(h);
  }

  // Find which original header maps to each normalized field
  const fieldToHeader: Record<string, string> = {};
  for (const [original, normalized] of Object.entries(headerMap)) {
    fieldToHeader[normalized] = original;
  }

  const parsed: ParsedImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const getValue = (field: string): string => {
      const header = fieldToHeader[field];
      return header ? (row[header] || '').trim() : '';
    };

    let amount = parseAmount(getValue('amount'));
    const type = getValue('type');
    if (amount !== null && type) {
      amount = resolveAmountSign(amount, type);
    }

    parsed.push({
      rowNumber: i + 2, // +2 because row 1 is header, and rows are 0-indexed
      id: getValue('id') || undefined,
      externalId: getValue('externalId') || undefined,
      date: parseDate(getValue('date')),
      amount,
      description: getValue('description'),
      merchant: getValue('merchant'),
      categoryName: getValue('category'),
      accountName: getValue('account'),
      notes: getValue('notes'),
      type,
      isManual: getValue('isManual') === 'true' ? true : getValue('isManual') === 'false' ? false : undefined,
    });
  }

  return parsed;
}

/**
 * Resolve account IDs by name for all rows
 */
async function resolveAccounts(
  rows: ParsedImportRow[],
  householdId: string,
  defaultAccountId: string | null
): Promise<Map<string, string>> {
  // Get all household accounts
  const accounts = await prisma.account.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });

  const accountByName = new Map<string, string>();
  for (const a of accounts) {
    accountByName.set(a.name.toLowerCase(), a.id);
  }

  // Build row-to-accountId map
  const result = new Map<string, string>();
  const uniqueNames = new Set(rows.map((r) => r.accountName).filter(Boolean));

  for (const name of uniqueNames) {
    const accountId = accountByName.get(name.toLowerCase());
    if (accountId) {
      result.set(name.toLowerCase(), accountId);
    }
  }

  // Add default fallback
  if (defaultAccountId) {
    result.set('__default__', defaultAccountId);
  }

  return result;
}

/**
 * Resolve category IDs by name
 */
async function resolveCategories(
  rows: ParsedImportRow[],
  householdId: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueNames = new Set(rows.map((r) => r.categoryName).filter(Boolean));

  for (const name of uniqueNames) {
    // Handle "Parent > Child" format
    const parts = name.split('>').map((p) => p.trim());
    const leafName = parts[parts.length - 1];

    const categoryId = await getCategoryIdByName(prisma, householdId, leafName);
    if (categoryId) {
      result.set(name.toLowerCase(), categoryId);
    }
  }

  return result;
}

/**
 * Process an import — used by both preview and execute
 */
export async function processImport(
  csvContent: string,
  householdId: string,
  defaultAccountId: string | null,
  mode: 'preview' | 'execute',
  skipRowNumbers: number[] = []
): Promise<ImportPreviewResponse | ImportExecuteResponse> {
  // 1. Parse CSV
  const parsedRows = parseImportRows(csvContent);

  if (parsedRows.length === 0) {
    if (mode === 'preview') {
      return { totalRows: 0, summary: { create: 0, update: 0, skip: 0, unchanged: 0 }, rows: [] };
    }
    return { created: 0, updated: 0, skipped: 0, rulesApplied: 0, skippedDetails: [] };
  }

  // 2. Resolve accounts and categories
  const [accountMap, categoryMap] = await Promise.all([
    resolveAccounts(parsedRows, householdId, defaultAccountId),
    resolveCategories(parsedRows, householdId),
  ]);

  // Get account names for display
  const accounts = await prisma.account.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  // 3. Determine date range and pre-fetch existing transactions
  const validDates = parsedRows.map((r) => r.date).filter((d): d is Date => d !== null);
  let existingTransactions: ExistingTransaction[] = [];

  if (validDates.length > 0) {
    const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 3);

    const rawTxs = await prisma.transaction.findMany({
      where: {
        account: { householdId },
        date: { gte: minDate, lte: maxDate },
      },
      include: {
        account: { select: { id: true, type: true, ownerId: true } },
      },
    });

    existingTransactions = rawTxs.map((tx) => ({
      id: tx.id,
      externalId: tx.externalId,
      date: tx.date,
      amount: Number(tx.amount),
      description: tx.description,
      merchantName: tx.merchantName,
      categoryId: tx.categoryId,
      accountId: tx.accountId,
      isManual: tx.isManual,
      notes: tx.notes,
      account: tx.account as { id: string; type: string; ownerId: string | null },
    }));
  }

  // Group existing transactions by account for faster lookup
  const existingByAccount = new Map<string, ExistingTransaction[]>();
  for (const tx of existingTransactions) {
    const list = existingByAccount.get(tx.accountId) || [];
    list.push(tx);
    existingByAccount.set(tx.accountId, list);
  }

  // Also index by externalId and internal id for exact matching
  const existingByExternalId = new Map<string, ExistingTransaction>();
  const existingById = new Map<string, ExistingTransaction>();
  for (const tx of existingTransactions) {
    if (tx.externalId) existingByExternalId.set(tx.externalId, tx);
    existingById.set(tx.id, tx);
  }

  // 4. Process each row
  const previewRows: ImportPreviewRow[] = [];
  const matchedTxIds = new Set<string>(); // Track which existing txs have been matched

  for (const row of parsedRows) {
    const warnings: string[] = [];

    // Validate required fields
    if (!row.date) {
      previewRows.push({
        rowNumber: row.rowNumber,
        action: 'skip',
        parsed: { date: '', amount: 0, description: row.description, accountId: '', accountName: '', notes: row.notes },
        skipReason: row.date === null && !row.description ? 'Empty row' : `Invalid date: '${row.description ? 'missing' : ''}'`,
        warnings: [],
      });
      continue;
    }

    if (!row.description) {
      previewRows.push({
        rowNumber: row.rowNumber,
        action: 'skip',
        parsed: { date: row.date.toISOString().split('T')[0], amount: row.amount || 0, description: '', accountId: '', accountName: '', notes: row.notes },
        skipReason: 'Missing required field: description',
        warnings: [],
      });
      continue;
    }

    if (row.amount === null || row.amount === 0) {
      previewRows.push({
        rowNumber: row.rowNumber,
        action: 'skip',
        parsed: { date: row.date.toISOString().split('T')[0], amount: 0, description: row.description, accountId: '', accountName: '', notes: row.notes },
        skipReason: `Invalid or zero amount`,
        warnings: [],
      });
      continue;
    }

    // Resolve account
    let accountId: string | undefined;
    if (row.accountName) {
      accountId = accountMap.get(row.accountName.toLowerCase());
      if (!accountId) {
        // Account name in CSV doesn't match any household account — try default
        accountId = accountMap.get('__default__');
        if (!accountId) {
          previewRows.push({
            rowNumber: row.rowNumber,
            action: 'skip',
            parsed: { date: row.date.toISOString().split('T')[0], amount: row.amount, description: row.description, accountId: '', accountName: row.accountName, notes: row.notes },
            skipReason: `Account not found: '${row.accountName}'`,
            warnings: [],
          });
          continue;
        }
      }
    } else {
      // No account column value — use default
      accountId = accountMap.get('__default__');
      if (!accountId) {
        previewRows.push({
          rowNumber: row.rowNumber,
          action: 'skip',
          parsed: { date: row.date.toISOString().split('T')[0], amount: row.amount, description: row.description, accountId: '', accountName: '', notes: row.notes },
          skipReason: 'No account specified and no default account selected',
          warnings: [],
        });
        continue;
      }
    }

    const accountName = accountNameById.get(accountId) || row.accountName;

    // Resolve category
    let categoryId: string | null = null;
    if (row.categoryName) {
      categoryId = categoryMap.get(row.categoryName.toLowerCase()) || null;
      if (!categoryId) {
        warnings.push(`Category not found: '${row.categoryName}' — will be left uncategorized`);
      }
    }

    // Match against existing transactions
    let matchedTx: ExistingTransaction | null = null;
    let matchConfidence: number | null = null;

    // Step 1: Exact match by external ID
    if (row.externalId) {
      const existing = existingByExternalId.get(row.externalId);
      if (existing && !matchedTxIds.has(existing.id)) {
        matchedTx = existing;
        matchConfidence = 1.0;
      }
    }

    // Step 2: Exact match by internal ID
    if (!matchedTx && row.id) {
      const existing = existingById.get(row.id);
      if (existing && !matchedTxIds.has(existing.id)) {
        matchedTx = existing;
        matchConfidence = 1.0;
      }
    }

    // Step 3: Fuzzy match
    if (!matchedTx) {
      const candidates = existingByAccount.get(accountId) || [];
      let bestScore = 0;
      let bestCandidate: ExistingTransaction | null = null;

      for (const candidate of candidates) {
        if (matchedTxIds.has(candidate.id)) continue;

        const score = computeSimilarityScore(
          { date: row.date, amount: row.amount, description: row.description, merchant: row.merchant },
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

    // Check for duplicate matches
    if (matchedTx && matchedTxIds.has(matchedTx.id)) {
      action = 'skip';
      previewRows.push({
        rowNumber: row.rowNumber,
        action: 'skip',
        parsed: { date: row.date.toISOString().split('T')[0], amount: row.amount, description: row.description, merchant: row.merchant, category: row.categoryName, categoryId, accountId, accountName, notes: row.notes },
        skipReason: `Duplicate match: another row already matches transaction '${matchedTx.description}'`,
        warnings,
      });
      continue;
    }

    // Compute actual changes for update rows
    let changes: ImportFieldChange[] = [];

    if (matchedTx) {
      matchedTxIds.add(matchedTx.id);

      // Check each field for actual differences
      if (row.description && row.description !== matchedTx.description) {
        changes.push({ field: 'Description', from: matchedTx.description, to: row.description });
      }
      if (row.merchant && row.merchant !== (matchedTx.merchantName || '')) {
        changes.push({ field: 'Merchant', from: matchedTx.merchantName || '(none)', to: row.merchant });
      }
      if (categoryId && categoryId !== matchedTx.categoryId) {
        // Resolve names for display
        const fromName = matchedTx.categoryId ? '(existing)' : '(none)';
        changes.push({ field: 'Category', from: fromName, to: row.categoryName || '(none)' });
      }
      if (row.notes && row.notes !== (matchedTx.notes || '')) {
        changes.push({ field: 'Notes', from: matchedTx.notes || '(none)', to: row.notes });
      }
      if (Math.abs(row.amount - matchedTx.amount) >= 0.01) {
        changes.push({ field: 'Amount', from: String(matchedTx.amount), to: String(row.amount) });
      }

      // If nothing actually changed, mark as unchanged instead of update
      if (changes.length === 0) {
        action = 'unchanged';
      }
    }

    previewRows.push({
      rowNumber: row.rowNumber,
      action,
      parsed: {
        date: row.date.toISOString().split('T')[0],
        amount: row.amount,
        description: row.description,
        merchant: row.merchant || undefined,
        category: row.categoryName || undefined,
        categoryId,
        accountId,
        accountName,
        notes: row.notes || undefined,
      },
      matchedTransaction: matchedTx
        ? {
            id: matchedTx.id,
            date: matchedTx.date.toISOString().split('T')[0],
            amount: matchedTx.amount,
            description: matchedTx.description,
            merchantName: matchedTx.merchantName,
            categoryId: matchedTx.categoryId,
            notes: matchedTx.notes,
            isManual: matchedTx.isManual,
          }
        : null,
      matchConfidence,
      changes: changes.length > 0 ? changes : undefined,
      skipReason: null,
      warnings,
    });
  }

  // 5. Build summary
  const summary = { create: 0, update: 0, skip: 0, unchanged: 0 };
  for (const row of previewRows) {
    summary[row.action]++;
  }

  if (mode === 'preview') {
    return {
      totalRows: parsedRows.length,
      summary,
      rows: previewRows,
    };
  }

  // 6. Execute mode — apply changes
  const skipSet = new Set(skipRowNumbers);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let rulesApplied = 0;
  const skippedDetails: { rowNumber: number; reason: string }[] = [];

  // Collect skipped rows from validation
  for (const row of previewRows) {
    if (row.action === 'skip') {
      skipped++;
      skippedDetails.push({ rowNumber: row.rowNumber, reason: row.skipReason || 'Unknown' });
    }
  }

  // Process creates and updates inside a transaction (skip unchanged rows too)
  const actionRows = previewRows.filter(
    (r) => (r.action === 'create' || r.action === 'update') && !skipSet.has(r.rowNumber)
  );

  // Process user-skipped rows
  for (const row of previewRows) {
    if ((row.action === 'create' || row.action === 'update') && skipSet.has(row.rowNumber)) {
      skipped++;
      skippedDetails.push({ rowNumber: row.rowNumber, reason: 'Skipped by user' });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of actionRows) {
      if (row.action === 'create') {
        let finalCategoryId = row.parsed.categoryId || null;

        // Apply rules engine if no category
        if (!finalCategoryId) {
          const account = await tx.account.findUnique({
            where: { id: row.parsed.accountId },
            select: { id: true, type: true, ownerId: true },
          });

          if (account) {
            const tempTx = {
              id: 'temp',
              accountId: row.parsed.accountId,
              amount: new Decimal(row.parsed.amount),
              merchantName: row.parsed.merchant || null,
              description: row.parsed.description,
              date: new Date(row.parsed.date),
              account: account as any,
            };

            // Use the non-transactional prisma for rule lookup (read-only)
            finalCategoryId = await applyRulesToTransaction(tempTx as any, householdId);
            if (finalCategoryId) rulesApplied++;
          }
        }

        await tx.transaction.create({
          data: {
            accountId: row.parsed.accountId,
            date: new Date(row.parsed.date),
            amount: new Decimal(row.parsed.amount),
            description: row.parsed.description,
            merchantName: row.parsed.merchant || null,
            categoryId: finalCategoryId,
            notes: row.parsed.notes || null,
            isManual: true,
          },
        });

        // Update account balance for new manual transactions
        await tx.account.update({
          where: { id: row.parsed.accountId },
          data: {
            currentBalance: { increment: new Decimal(row.parsed.amount) },
          },
        });

        created++;
      } else if (row.action === 'update' && row.matchedTransaction) {
        const updateData: any = {};

        // Only update non-empty fields
        if (row.parsed.description) updateData.description = row.parsed.description;
        if (row.parsed.merchant) updateData.merchantName = row.parsed.merchant;
        if (row.parsed.categoryId) updateData.categoryId = row.parsed.categoryId;
        if (row.parsed.notes) updateData.notes = row.parsed.notes;

        // Handle amount changes
        if (row.parsed.amount !== row.matchedTransaction.amount) {
          updateData.amount = new Decimal(row.parsed.amount);

          // Only update balance for manual transactions
          if (row.matchedTransaction.isManual) {
            const diff = row.parsed.amount - row.matchedTransaction.amount;
            await tx.account.update({
              where: { id: row.parsed.accountId },
              data: {
                currentBalance: { increment: new Decimal(diff) },
              },
            });
          }
        }

        if (Object.keys(updateData).length > 0) {
          await tx.transaction.update({
            where: { id: row.matchedTransaction.id },
            data: updateData,
          });
        }

        updated++;
      }
    }
  });

  return { created, updated, skipped, rulesApplied, skippedDetails };
}
