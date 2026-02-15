import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { plaidClient, mapPlaidAccountType, normalizeTransactionAmount } from '../utils/plaid';
import { mapPlaidCategory, getCategoryIdByName } from '../utils/categoryMapping';
import { CountryCode, Products } from 'plaid';
import { authenticate, requireHousehold } from '../middleware/auth';
import { applyRulesToTransaction } from '../services/ruleEngine';
import { buildPlaidTransactionPreview } from '../services/plaidMatcher';

const router = express.Router();

// ============================================
// POST /api/plaid/webhook
// Handle Plaid webhooks (does not require auth)
// Must be defined BEFORE auth middleware
// ============================================
router.post('/webhook', async (req, res, next) => {
  try {
    const { webhook_type, webhook_code, item_id } = req.body;

    console.log(`Received Plaid webhook: ${webhook_type} - ${webhook_code} for item ${item_id}`);

    // Find the Plaid item
    const plaidItem = await prisma.plaidItem.findUnique({
      where: { itemId: item_id },
    });

    if (!plaidItem) {
      console.warn(`Plaid webhook received for unknown item: ${item_id}`);
      return res.json({ success: true }); // Still return 200 to Plaid
    }

    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook_code, plaidItem);
        break;

      case 'ITEM':
        await handleItemWebhook(webhook_code, plaidItem);
        break;

      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing Plaid webhook:', error);
    // Always return 200 to Plaid to avoid retries
    res.json({ success: false });
  }
});

// All routes below require authentication and household membership
router.use(authenticate);
router.use(requireHousehold);

// ============================================
// POST /api/plaid/link-token
// Generate a Link token for a user to connect their bank
// ============================================
const linkTokenSchema = z.object({
  itemId: z.string().optional(), // For update mode
});

router.post('/link-token', async (req, res, next) => {
  try {
    const { itemId } = linkTokenSchema.parse(req.body);
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const linkTokenRequest: any = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Otter Money',
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    // If itemId is provided, this is for re-authentication (update mode)
    if (itemId) {
      const plaidItem = await prisma.plaidItem.findFirst({
        where: {
          itemId,
          userId,
        },
      });

      if (!plaidItem) {
        return res.status(404).json({ error: 'Plaid item not found' });
      }

      linkTokenRequest.access_token = plaidItem.accessToken;
    } else {
      // New connection - specify products
      linkTokenRequest.products = [Products.Transactions];
    }

    // Create a link token
    const response = await plaidClient.linkTokenCreate(linkTokenRequest);

    res.json({ data: { linkToken: response.data.link_token } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/exchange-token
// Exchange public token for access token and sync accounts
// ============================================
const exchangeTokenSchema = z.object({
  publicToken: z.string(),
});

router.post('/exchange-token', async (req, res, next) => {
  try {
    const { publicToken } = exchangeTokenSchema.parse(req.body);
    const userId = req.user!.id;

    // Get user's household
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return res.status(400).json({ error: 'User must be in a household' });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id || undefined;
    let institutionName: string | undefined;

    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (err) {
        console.error('Failed to fetch institution name:', err);
      }
    }

    // Store Plaid item
    const plaidItem = await prisma.plaidItem.create({
      data: {
        userId,
        itemId,
        accessToken,
        institutionId,
        institutionName,
      },
    });

    // Fetch and create accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = await Promise.all(
      accountsResponse.data.accounts.map(async (plaidAccount) => {
        const accountType = mapPlaidAccountType(
          plaidAccount.type,
          plaidAccount.subtype || null
        );

        return prisma.account.create({
          data: {
            householdId: user.householdId!,
            ownerId: userId, // Auto-assign to the connecting user
            name: plaidAccount.name,
            officialName: plaidAccount.name,
            type: accountType as any,
            subtype: plaidAccount.subtype || undefined,
            connectionType: 'PLAID',
            plaidItemId: itemId,
            plaidAccountId: plaidAccount.account_id,
            currentBalance: plaidAccount.balances.current || 0,
            availableBalance: plaidAccount.balances.available || undefined,
            currency: plaidAccount.balances.iso_currency_code || 'USD',
            lastSyncedAt: new Date(),
          },
        });
      })
    );

    // Sync transactions immediately after creating accounts
    console.log(`Starting initial transaction sync for item ${itemId}`);
    try {
      await syncPlaidTransactions({
        id: plaidItem.id,
        itemId: plaidItem.itemId,
        accessToken: plaidItem.accessToken,
        cursor: null,
      });
      console.log(`Initial transaction sync completed for item ${itemId}`);
    } catch (syncError) {
      console.error(`Failed to sync transactions for item ${itemId}:`, syncError);
      // Don't fail the whole request if sync fails - webhooks will retry
    }

    res.json({
      data: {
        success: true,
        itemId: plaidItem.itemId,
        institutionName: plaidItem.institutionName,
        accountsCreated: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.currentBalance,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/exchange-token-preview
// Exchange token and return preview of accounts + transactions
// for mapping to existing accounts before committing
// ============================================
const exchangeTokenPreviewSchema = z.object({
  publicToken: z.string(),
});

router.post('/exchange-token-preview', async (req, res, next) => {
  try {
    const { publicToken } = exchangeTokenPreviewSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return res.status(400).json({ error: 'User must be in a household' });
    }

    // Exchange public token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id || undefined;
    let institutionName: string | undefined;

    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (err) {
        console.error('Failed to fetch institution name:', err);
      }
    }

    // Store PlaidItem temporarily (will be used by execute endpoint)
    const plaidItem = await prisma.plaidItem.create({
      data: {
        userId,
        itemId,
        accessToken,
        institutionId,
        institutionName,
      },
    });

    // Fetch Plaid accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Fetch initial batch of transactions
    let allTransactions: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      allTransactions = allTransactions.concat(syncResponse.data.added);
      cursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;
    }

    // Save cursor for later use
    await prisma.plaidItem.update({
      where: { id: plaidItem.id },
      data: { cursor },
    });

    // Find existing manual/disconnected accounts that could match
    const existingAccounts = await prisma.account.findMany({
      where: {
        householdId: user.householdId,
        connectionType: 'MANUAL',
      },
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        currentBalance: true,
      },
    });

    // Build preview for each Plaid account
    const plaidAccountPreviews = await Promise.all(
      accountsResponse.data.accounts.map(async (plaidAccount) => {
        const accountType = mapPlaidAccountType(
          plaidAccount.type,
          plaidAccount.subtype || null
        );

        // Find transactions for this Plaid account
        const accountTransactions = allTransactions.filter(
          (tx: any) => tx.account_id === plaidAccount.account_id
        );

        // Try to suggest a matching existing account
        let suggestedMatch: { accountId: string; accountName: string; matchReason: string } | null = null;

        for (const existing of existingAccounts) {
          // Match by officialName (from a previous Plaid connection)
          if (existing.officialName && existing.officialName.toLowerCase() === plaidAccount.name.toLowerCase()) {
            suggestedMatch = {
              accountId: existing.id,
              accountName: existing.name,
              matchReason: `Name matches: "${existing.officialName}"`,
            };
            break;
          }
          // Match by account name + type
          if (existing.name.toLowerCase() === plaidAccount.name.toLowerCase() && existing.type === accountType) {
            suggestedMatch = {
              accountId: existing.id,
              accountName: existing.name,
              matchReason: `Same name and type`,
            };
            break;
          }
        }

        // Build transaction preview against the suggested match (or empty if no match)
        let transactionPreview;
        if (suggestedMatch) {
          transactionPreview = await buildPlaidTransactionPreview(
            accountTransactions,
            suggestedMatch.accountId,
            suggestedMatch.accountName,
            user.householdId!
          );
        } else {
          // All transactions are "new" when there's no existing account
          transactionPreview = {
            totalRows: accountTransactions.length,
            summary: { create: accountTransactions.length, update: 0, skip: 0, unchanged: 0 },
            rows: accountTransactions.map((tx: any, i: number) => {
              const normalizedAmount = normalizeTransactionAmount(
                tx.amount,
                tx.name,
                tx.personal_finance_category
              );
              return {
                rowNumber: i + 1,
                action: 'create' as const,
                parsed: {
                  date: tx.date,
                  amount: normalizedAmount,
                  description: tx.name,
                  merchant: tx.merchant_name || undefined,
                  accountId: '',
                  accountName: plaidAccount.name,
                },
                matchedTransaction: null,
                matchConfidence: null,
                skipReason: null,
                warnings: tx.pending ? ['Pending transaction — may change or be removed'] : [],
              };
            }),
          };
        }

        return {
          plaidAccountId: plaidAccount.account_id,
          name: plaidAccount.name,
          officialName: plaidAccount.official_name || null,
          type: accountType,
          subtype: plaidAccount.subtype || null,
          currentBalance: plaidAccount.balances.current || 0,
          availableBalance: plaidAccount.balances.available || null,
          suggestedMatch,
          transactionPreview,
        };
      })
    );

    res.json({
      data: {
        tempItemId: plaidItem.itemId,
        institutionName: plaidItem.institutionName || null,
        plaidAccounts: plaidAccountPreviews,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/exchange-token-execute
// Execute the Plaid connection after user approves mappings
// ============================================
const executeSchema = z.object({
  tempItemId: z.string(),
  mappings: z.array(
    z.object({
      plaidAccountId: z.string(),
      existingAccountId: z.string().nullable(),
      skipTransactionIds: z.array(z.string()).default([]),
    })
  ),
});

router.post('/exchange-token-execute', async (req, res, next) => {
  try {
    const { tempItemId, mappings } = executeSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return res.status(400).json({ error: 'User must be in a household' });
    }

    // Find the PlaidItem created during preview
    const plaidItem = await prisma.plaidItem.findFirst({
      where: { itemId: tempItemId, userId },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid connection not found. Please try connecting again.' });
    }

    // Fetch accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: plaidItem.accessToken,
    });

    // Replay transaction sync (using saved cursor from preview, cursor was saved after full sync)
    // Since we already did a full sync during preview and saved the cursor,
    // we won't re-fetch — we'll sync from scratch to get the same transactions
    let allTransactions: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    // Reset cursor to get all transactions again
    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: plaidItem.accessToken,
        cursor,
      });

      allTransactions = allTransactions.concat(syncResponse.data.added);
      cursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;
    }

    // Save final cursor
    await prisma.plaidItem.update({
      where: { id: plaidItem.id },
      data: { cursor },
    });

    const householdId = user.householdId!;
    let accountsLinked = 0;
    let accountsCreated = 0;
    let transactionsAdded = 0;
    let transactionsSkipped = 0;

    const skipExternalIds = new Set(mappings.flatMap((m) => m.skipTransactionIds));

    for (const mapping of mappings) {
      const plaidAccount = accountsResponse.data.accounts.find(
        (a) => a.account_id === mapping.plaidAccountId
      );
      if (!plaidAccount) continue;

      const accountType = mapPlaidAccountType(
        plaidAccount.type,
        plaidAccount.subtype || null
      );

      let accountId: string;

      if (mapping.existingAccountId) {
        // Link to existing account
        await prisma.account.update({
          where: { id: mapping.existingAccountId },
          data: {
            connectionType: 'PLAID',
            connectionStatus: 'ACTIVE',
            plaidItemId: plaidItem.itemId,
            plaidAccountId: plaidAccount.account_id,
            officialName: plaidAccount.name,
            currentBalance: plaidAccount.balances.current || 0,
            availableBalance: plaidAccount.balances.available || undefined,
            lastSyncedAt: new Date(),
          },
        });
        accountId = mapping.existingAccountId;
        accountsLinked++;
      } else {
        // Create new account
        const newAccount = await prisma.account.create({
          data: {
            householdId,
            ownerId: userId,
            name: plaidAccount.name,
            officialName: plaidAccount.name,
            type: accountType as any,
            subtype: plaidAccount.subtype || undefined,
            connectionType: 'PLAID',
            plaidItemId: plaidItem.itemId,
            plaidAccountId: plaidAccount.account_id,
            currentBalance: plaidAccount.balances.current || 0,
            availableBalance: plaidAccount.balances.available || undefined,
            currency: plaidAccount.balances.iso_currency_code || 'USD',
            lastSyncedAt: new Date(),
          },
        });
        accountId = newAccount.id;
        accountsCreated++;
      }

      // Sync transactions for this account
      const accountTransactions = allTransactions.filter(
        (tx: any) => tx.account_id === mapping.plaidAccountId
      );

      if (mapping.existingAccountId) {
        // Linking to existing account — use fuzzy matching to avoid duplicates.
        // Plaid assigns NEW transaction_ids after reconnect, so upsert by externalId
        // would miss old transactions and create duplicates.
        const preview = await buildPlaidTransactionPreview(
          accountTransactions,
          accountId,
          plaidAccount.name,
          householdId
        );

        for (const row of preview.rows) {
          const plaidTx = accountTransactions[row.rowNumber - 1];
          if (!plaidTx) continue;

          if (skipExternalIds.has(plaidTx.transaction_id)) {
            transactionsSkipped++;
            continue;
          }

          if (row.action === 'unchanged' && row.matchedTransaction) {
            // Transaction already exists and hasn't changed — just update the externalId
            // so future Plaid syncs can match by externalId
            await prisma.transaction.update({
              where: { id: row.matchedTransaction.id },
              data: { externalId: plaidTx.transaction_id },
            });
            transactionsSkipped++;
          } else if (row.action === 'update' && row.matchedTransaction) {
            // Transaction exists but has changes — update it and set new externalId
            let categoryId: string | undefined;
            if (plaidTx.personal_finance_category) {
              const categoryName = mapPlaidCategory([
                plaidTx.personal_finance_category.primary,
                plaidTx.personal_finance_category.detailed,
              ]);
              if (categoryName) {
                categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || undefined;
              }
            }

            const normalizedAmount = normalizeTransactionAmount(
              plaidTx.amount,
              plaidTx.name,
              plaidTx.personal_finance_category
            );

            await prisma.transaction.update({
              where: { id: row.matchedTransaction.id },
              data: {
                externalId: plaidTx.transaction_id,
                amount: normalizedAmount,
                merchantName: plaidTx.merchant_name || undefined,
                description: plaidTx.name,
                date: new Date(plaidTx.date),
                isPending: plaidTx.pending,
                isManual: false,
                ...(categoryId ? { categoryId } : {}),
              },
            });
            transactionsAdded++;
          } else if (row.action === 'create') {
            // Truly new transaction — create it
            let categoryId: string | undefined;
            if (plaidTx.personal_finance_category) {
              const categoryName = mapPlaidCategory([
                plaidTx.personal_finance_category.primary,
                plaidTx.personal_finance_category.detailed,
              ]);
              if (categoryName) {
                categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || undefined;
              }
            }

            const normalizedAmount = normalizeTransactionAmount(
              plaidTx.amount,
              plaidTx.name,
              plaidTx.personal_finance_category
            );

            const transaction = await prisma.transaction.create({
              data: {
                accountId,
                externalId: plaidTx.transaction_id,
                amount: normalizedAmount,
                merchantName: plaidTx.merchant_name || undefined,
                description: plaidTx.name,
                date: new Date(plaidTx.date),
                isPending: plaidTx.pending,
                isManual: false,
                categoryId,
              },
              include: {
                account: {
                  select: { id: true, type: true, ownerId: true },
                },
              },
            });

            // Apply rules if no category
            if (!categoryId) {
              const ruleCategoryId = await applyRulesToTransaction(transaction, householdId);
              if (ruleCategoryId) {
                await prisma.transaction.update({
                  where: { id: transaction.id },
                  data: { categoryId: ruleCategoryId },
                });
              }
            }

            transactionsAdded++;
          } else {
            // skip
            transactionsSkipped++;
          }
        }
      } else {
        // New account — all transactions are new, upsert by externalId is safe
        for (const tx of accountTransactions) {
          if (skipExternalIds.has(tx.transaction_id)) {
            transactionsSkipped++;
            continue;
          }

          let categoryId: string | undefined;
          if (tx.personal_finance_category) {
            const categoryName = mapPlaidCategory([
              tx.personal_finance_category.primary,
              tx.personal_finance_category.detailed,
            ]);
            if (categoryName) {
              categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || undefined;
            }
          }

          const normalizedAmount = normalizeTransactionAmount(
            tx.amount,
            tx.name,
            tx.personal_finance_category
          );

          const transaction = await prisma.transaction.upsert({
            where: {
              externalId: tx.transaction_id,
            },
            update: {
              amount: normalizedAmount,
              merchantName: tx.merchant_name || undefined,
              description: tx.name,
              date: new Date(tx.date),
              isPending: tx.pending,
              categoryId,
            },
            create: {
              accountId,
              externalId: tx.transaction_id,
              amount: normalizedAmount,
              merchantName: tx.merchant_name || undefined,
              description: tx.name,
              date: new Date(tx.date),
              isPending: tx.pending,
              isManual: false,
              categoryId,
            },
            include: {
              account: {
                select: { id: true, type: true, ownerId: true },
              },
            },
          });

          // Apply rules if no category
          if (!categoryId) {
            const ruleCategoryId = await applyRulesToTransaction(transaction, householdId);
            if (ruleCategoryId) {
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: { categoryId: ruleCategoryId },
              });
            }
          }

          transactionsAdded++;
        }
      }
    }

    res.json({
      data: {
        success: true,
        accountsLinked,
        accountsCreated,
        transactionsAdded,
        transactionsSkipped,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/sync-transactions
// Sync transactions for a specific Plaid item
// ============================================
const syncTransactionsSchema = z.object({
  itemId: z.string(),
});

router.post('/sync-transactions', async (req, res, next) => {
  try {
    const { itemId } = syncTransactionsSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify the user owns this Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Get accounts for this item with household info
    const accounts = await prisma.account.findMany({
      where: {
        plaidItemId: itemId,
      },
      select: {
        id: true,
        plaidAccountId: true,
        householdId: true,
      },
    });

    if (accounts.length === 0) {
      return res.json({ data: { success: true, added: 0, modified: 0, removed: 0 } });
    }

    const householdId = accounts[0].householdId;

    let cursor = plaidItem.cursor || undefined;
    let hasMore = true;
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: plaidItem.accessToken,
        cursor,
      });

      const { added, modified, removed, next_cursor, has_more } = response.data;

      // Debug log for transaction sync - shows raw Plaid data
      console.log(`[PLAID SYNC] Institution: ${plaidItem.institutionName}, Processing ${added.length} added, ${modified.length} modified, ${removed.length} removed`);
      for (const tx of added) {
        console.log(`[PLAID TX RAW] date: ${tx.date} | amount: ${tx.amount} | name: "${tx.name}" | merchant: "${tx.merchant_name}" | category: ${tx.personal_finance_category?.primary}/${tx.personal_finance_category?.detailed}`);
      }

      // Process added transactions
      for (const tx of added) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;

        // Try to map Plaid category to our category
        let categoryId: string | undefined;
        if (tx.personal_finance_category) {
          const categoryName = mapPlaidCategory([
            tx.personal_finance_category.primary,
            tx.personal_finance_category.detailed,
          ]);
          if (categoryName) {
            categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || undefined;
          }
        }

        // Normalize amount based on description (handles institutions like PenFed with non-standard sign conventions)
        const normalizedAmount = normalizeTransactionAmount(
          tx.amount,
          tx.name,
          tx.personal_finance_category
        );

        const transaction = await prisma.transaction.upsert({
          where: {
            externalId: tx.transaction_id,
          },
          update: {
            amount: normalizedAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            categoryId,
          },
          create: {
            accountId: account.id,
            externalId: tx.transaction_id,
            amount: normalizedAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            isManual: false,
            categoryId,
          },
          include: {
            account: {
              select: { id: true, type: true, ownerId: true },
            },
          },
        });

        // If no category was assigned from Plaid, try applying rules
        if (!categoryId) {
          const ruleCategoryId = await applyRulesToTransaction(transaction, householdId);
          if (ruleCategoryId) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { categoryId: ruleCategoryId },
            });
          }
        }

        addedCount++;
      }

      // Process modified transactions
      for (const tx of modified) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;

        const normalizedAmount = normalizeTransactionAmount(
          tx.amount,
          tx.name,
          tx.personal_finance_category
        );

        await prisma.transaction.updateMany({
          where: {
            externalId: tx.transaction_id,
          },
          data: {
            amount: normalizedAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
          },
        });
        modifiedCount++;
      }

      // Process removed transactions
      for (const removedTx of removed) {
        await prisma.transaction.deleteMany({
          where: {
            externalId: removedTx.transaction_id,
          },
        });
        removedCount++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    // Update cursor
    await prisma.plaidItem.update({
      where: { id: plaidItem.id },
      data: { cursor },
    });

    // Refresh account balances from Plaid
    try {
      const balancesResponse = await plaidClient.accountsGet({
        access_token: plaidItem.accessToken,
      });

      for (const plaidAccount of balancesResponse.data.accounts) {
        await prisma.account.updateMany({
          where: {
            plaidItemId: itemId,
            plaidAccountId: plaidAccount.account_id,
          },
          data: {
            currentBalance: plaidAccount.balances.current || 0,
            availableBalance: plaidAccount.balances.available || undefined,
            lastSyncedAt: new Date(),
          },
        });
      }
    } catch (balanceError) {
      console.error(`Failed to refresh balances for item ${itemId}:`, balanceError);
      // Still update lastSyncedAt even if balance refresh fails
      await prisma.account.updateMany({
        where: { plaidItemId: itemId },
        data: { lastSyncedAt: new Date() },
      });
    }

    res.json({
      data: {
        success: true,
        added: addedCount,
        modified: modifiedCount,
        removed: removedCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/plaid/items
// Get all Plaid items for the current user
// ============================================
router.get('/items', async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const items = await prisma.plaidItem.findMany({
      where: { userId },
      select: {
        itemId: true,
        institutionName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: { items } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/plaid/items/:itemId/details
// Get detailed info about a Plaid connection
// ============================================
router.get('/items/:itemId/details', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user!.id;

    // Look up PlaidItem — allow any household member to view
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId) {
      return res.status(400).json({ error: 'No household found' });
    }

    const plaidItem = await prisma.plaidItem.findFirst({
      where: { itemId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Verify the PlaidItem's user is in the same household
    const itemOwner = await prisma.user.findUnique({
      where: { id: plaidItem.userId },
      select: { householdId: true },
    });

    if (itemOwner?.householdId !== user.householdId) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Get all accounts linked to this item
    const accounts = await prisma.account.findMany({
      where: { plaidItemId: itemId },
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        connectionStatus: true,
        plaidAccountId: true,
        lastSyncedAt: true,
        currentBalance: true,
      },
    });

    res.json({
      data: {
        itemId: plaidItem.itemId,
        institutionName: plaidItem.institutionName,
        createdAt: plaidItem.createdAt.toISOString(),
        userId: plaidItem.user.id,
        userName: plaidItem.user.name,
        accounts: accounts.map((a) => ({
          ...a,
          currentBalance: Number(a.currentBalance),
          lastSyncedAt: a.lastSyncedAt?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/items/:itemId/disconnect
// Gracefully disconnect — keeps accounts & transactions
// ============================================
router.post('/items/:itemId/disconnect', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user!.id;

    // Verify the user owns this Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Get accounts linked to this item
    const accounts = await prisma.account.findMany({
      where: { plaidItemId: itemId },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    // Count transactions that will be preserved
    const transactionCount = await prisma.transaction.count({
      where: { accountId: { in: accountIds } },
    });

    // Convert accounts to MANUAL — preserve all data
    await prisma.account.updateMany({
      where: { plaidItemId: itemId },
      data: {
        connectionType: 'MANUAL',
        connectionStatus: 'ACTIVE',
        plaidItemId: null,
        plaidAccountId: null,
      },
    });

    // Delete the PlaidItem record from database
    await prisma.plaidItem.delete({
      where: { id: plaidItem.id },
    });

    // Revoke access on Plaid's side (do last, local cleanup is what matters)
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.accessToken,
      });
    } catch (err: any) {
      if (err?.response?.data?.error_code !== 'ITEM_NOT_FOUND') {
        console.error('Failed to remove item from Plaid:', err?.response?.data || err.message);
      }
    }

    res.json({
      data: {
        success: true,
        accountsDisconnected: accounts.length,
        transactionsPreserved: transactionCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/plaid/items/:itemId/reconnect
// Mark item for reconnection and update accounts
// ============================================
router.post('/items/:itemId/reconnect', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user!.id;

    // Verify the user owns this Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // After reconnection, update account statuses to ACTIVE
    await prisma.account.updateMany({
      where: { plaidItemId: itemId },
      data: { connectionStatus: 'ACTIVE' },
    });

    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /api/plaid/items/:itemId
// Remove a Plaid connection and its accounts
// ============================================
router.delete('/items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user!.id;

    // Verify the user owns this Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        itemId,
        userId,
      },
    });

    if (!plaidItem) {
      return res.status(404).json({ error: 'Plaid item not found' });
    }

    // Get accounts to delete
    const accounts = await prisma.account.findMany({
      where: { plaidItemId: itemId },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    // Count transactions that will be deleted
    const transactionCount = await prisma.transaction.count({
      where: { accountId: { in: accountIds } },
    });

    // Delete transactions first (before accounts due to foreign key)
    await prisma.transaction.deleteMany({
      where: { accountId: { in: accountIds } },
    });

    // Delete associated accounts
    await prisma.account.deleteMany({
      where: { plaidItemId: itemId },
    });

    // Delete the Plaid item from database
    await prisma.plaidItem.delete({
      where: { id: plaidItem.id },
    });

    // Remove the item from Plaid (do this last, after local cleanup succeeds)
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.accessToken,
      });
    } catch (err: any) {
      // Ignore ITEM_NOT_FOUND errors (item already removed)
      if (err?.response?.data?.error_code !== 'ITEM_NOT_FOUND') {
        console.error('Failed to remove item from Plaid:', err?.response?.data || err.message);
      }
      // Continue - local cleanup is what matters
    }

    res.json({
      data: {
        success: true,
        accountsDeleted: accounts.length,
        transactionsDeleted: transactionCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to handle TRANSACTIONS webhooks
async function handleTransactionsWebhook(
  webhookCode: string,
  plaidItem: { id: string; itemId: string; accessToken: string; cursor: string | null; institutionName?: string | null }
) {
  switch (webhookCode) {
    case 'SYNC_UPDATES_AVAILABLE':
    case 'DEFAULT_UPDATE':
    case 'INITIAL_UPDATE':
      // Trigger a transaction sync
      console.log(`Triggering transaction sync for item ${plaidItem.itemId}`);
      await syncPlaidTransactions(plaidItem);
      break;

    case 'TRANSACTIONS_REMOVED':
      // Transactions were removed - sync will handle this
      await syncPlaidTransactions(plaidItem);
      break;

    default:
      console.log(`Unhandled TRANSACTIONS webhook code: ${webhookCode}`);
  }
}

// Helper function to handle ITEM webhooks
async function handleItemWebhook(
  webhookCode: string,
  plaidItem: { id: string; itemId: string; accessToken: string }
) {
  switch (webhookCode) {
    case 'ERROR':
      // Item has an error - mark accounts as needing reauth
      console.log(`Item ${plaidItem.itemId} has an error - marking for reauth`);
      await prisma.account.updateMany({
        where: { plaidItemId: plaidItem.itemId },
        data: { connectionStatus: 'REQUIRES_REAUTH' },
      });
      break;

    case 'PENDING_EXPIRATION':
      // Item consent is expiring soon
      console.log(`Item ${plaidItem.itemId} consent expiring soon`);
      await prisma.account.updateMany({
        where: { plaidItemId: plaidItem.itemId },
        data: { connectionStatus: 'REQUIRES_REAUTH' },
      });
      break;

    case 'USER_PERMISSION_REVOKED':
      // User revoked consent - disconnect
      console.log(`Item ${plaidItem.itemId} consent revoked`);
      await prisma.account.updateMany({
        where: { plaidItemId: plaidItem.itemId },
        data: { connectionStatus: 'DISCONNECTED' },
      });
      break;

    case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
      // Webhook configuration acknowledged
      console.log(`Webhook update acknowledged for item ${plaidItem.itemId}`);
      break;

    default:
      console.log(`Unhandled ITEM webhook code: ${webhookCode}`);
  }
}

// Helper function to sync transactions (extracted from the POST route)
async function syncPlaidTransactions(plaidItem: {
  id: string;
  itemId: string;
  accessToken: string;
  cursor: string | null;
  institutionName?: string | null;
}) {
  try {
    const accounts = await prisma.account.findMany({
      where: { plaidItemId: plaidItem.itemId },
      select: {
        id: true,
        plaidAccountId: true,
        householdId: true,
      },
    });

    if (accounts.length === 0) return;

    const householdId = accounts[0].householdId;

    let cursor = plaidItem.cursor || undefined;
    let hasMore = true;
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let totalSkipped = 0;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: plaidItem.accessToken,
        cursor,
      });

      const { added, modified, removed, next_cursor, has_more } = response.data;

      // Debug log for transaction sync (webhook) - shows raw Plaid data
      console.log(`[PLAID WEBHOOK SYNC] Institution: ${plaidItem.institutionName}, Processing ${added.length} added, ${modified.length} modified, ${removed.length} removed`);
      for (const tx of added) {
        console.log(`[PLAID TX RAW] date: ${tx.date} | amount: ${tx.amount} | name: "${tx.name}" | merchant: "${tx.merchant_name}" | category: ${tx.personal_finance_category?.primary}/${tx.personal_finance_category?.detailed}`);
      }

      // Process added transactions
      for (const tx of added) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) {
          totalSkipped++;
          continue;
        }

        // Try to map Plaid category to our category
        let categoryId: string | undefined;
        if (tx.personal_finance_category) {
          const categoryName = mapPlaidCategory([
            tx.personal_finance_category.primary,
            tx.personal_finance_category.detailed,
          ]);
          if (categoryName) {
            categoryId = (await getCategoryIdByName(prisma, householdId, categoryName)) || undefined;
          }
        }

        // Normalize amount based on description (handles institutions like PenFed with non-standard sign conventions)
        const normalizedAmount = normalizeTransactionAmount(
          tx.amount,
          tx.name,
          tx.personal_finance_category
        );

        const transaction = await prisma.transaction.upsert({
          where: { externalId: tx.transaction_id },
          update: {
            amount: normalizedAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            categoryId,
          },
          create: {
            accountId: account.id,
            externalId: tx.transaction_id,
            amount: normalizedAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            isManual: false,
            categoryId,
          },
          include: {
            account: {
              select: { id: true, type: true, ownerId: true },
            },
          },
        });

        // If no category was assigned from Plaid, try applying rules
        if (!categoryId) {
          const ruleCategoryId = await applyRulesToTransaction(transaction, householdId);
          if (ruleCategoryId) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { categoryId: ruleCategoryId },
            });
          }
        }

        totalAdded++;
      }

      // Process modified transactions
      for (const tx of modified) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;

        const normalizedModAmount = normalizeTransactionAmount(
          tx.amount,
          tx.name,
          tx.personal_finance_category
        );

        await prisma.transaction.updateMany({
          where: { externalId: tx.transaction_id },
          data: {
            amount: normalizedModAmount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
          },
        });
        totalModified++;
      }

      // Process removed transactions
      for (const removedTx of removed) {
        await prisma.transaction.deleteMany({
          where: { externalId: removedTx.transaction_id },
        });
        totalRemoved++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    // Update cursor
    await prisma.plaidItem.update({
      where: { id: plaidItem.id },
      data: { cursor },
    });

    // Refresh account balances from Plaid
    try {
      const balancesResponse = await plaidClient.accountsGet({
        access_token: plaidItem.accessToken,
      });

      for (const plaidAccount of balancesResponse.data.accounts) {
        await prisma.account.updateMany({
          where: {
            plaidItemId: plaidItem.itemId,
            plaidAccountId: plaidAccount.account_id,
          },
          data: {
            currentBalance: plaidAccount.balances.current || 0,
            availableBalance: plaidAccount.balances.available || undefined,
            lastSyncedAt: new Date(),
          },
        });
      }
    } catch (balanceError) {
      console.error(`Failed to refresh balances for item ${plaidItem.itemId}:`, balanceError);
      // Still update lastSyncedAt even if balance refresh fails
      await prisma.account.updateMany({
        where: { plaidItemId: plaidItem.itemId },
        data: { lastSyncedAt: new Date() },
      });
    }

    console.log(
      `Synced ${totalAdded} added, ${totalModified} modified, ${totalRemoved} removed transactions for item ${plaidItem.itemId}` +
      (totalSkipped > 0 ? ` (${totalSkipped} skipped - account not found)` : '')
    );
  } catch (error) {
    console.error(`Failed to sync transactions for item ${plaidItem.itemId}:`, error);
    throw error;
  }
}

export default router;
