import express from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { plaidClient, mapPlaidAccountType } from '../utils/plaid';
import { mapPlaidCategory, getCategoryIdByName } from '../utils/categoryMapping';
import { CountryCode, Products } from 'plaid';
import { authenticate, requireHousehold } from '../middleware/auth';

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

    res.json({ linkToken: response.data.link_token });
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

    res.json({
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
      return res.json({ success: true, added: 0, modified: 0, removed: 0 });
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

        await prisma.transaction.upsert({
          where: {
            externalId: tx.transaction_id,
          },
          update: {
            amount: -tx.amount, // Plaid uses positive for outflows, we use negative
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            categoryId,
          },
          create: {
            accountId: account.id,
            externalId: tx.transaction_id,
            amount: -tx.amount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            isManual: false,
            categoryId,
          },
        });
        addedCount++;
      }

      // Process modified transactions
      for (const tx of modified) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;

        await prisma.transaction.updateMany({
          where: {
            externalId: tx.transaction_id,
          },
          data: {
            amount: -tx.amount,
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

    // Update lastSyncedAt for all accounts
    await prisma.account.updateMany({
      where: { plaidItemId: itemId },
      data: { lastSyncedAt: new Date() },
    });

    res.json({
      success: true,
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
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

    res.json({ items });
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

    res.json({ success: true });
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

    // Remove the item from Plaid
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.accessToken,
      });
    } catch (err) {
      console.error('Failed to remove item from Plaid:', err);
      // Continue with local cleanup even if Plaid fails
    }

    // Delete associated accounts (transactions will cascade)
    await prisma.account.deleteMany({
      where: { plaidItemId: itemId },
    });

    // Delete the Plaid item
    await prisma.plaidItem.delete({
      where: { id: plaidItem.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Helper function to handle TRANSACTIONS webhooks
async function handleTransactionsWebhook(
  webhookCode: string,
  plaidItem: { id: string; itemId: string; accessToken: string; cursor: string | null }
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

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: plaidItem.accessToken,
        cursor,
      });

      const { added, modified, removed, next_cursor, has_more } = response.data;

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

        await prisma.transaction.upsert({
          where: { externalId: tx.transaction_id },
          update: {
            amount: -tx.amount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            categoryId,
          },
          create: {
            accountId: account.id,
            externalId: tx.transaction_id,
            amount: -tx.amount,
            merchantName: tx.merchant_name || undefined,
            description: tx.name,
            date: new Date(tx.date),
            isPending: tx.pending,
            isManual: false,
            categoryId,
          },
        });
        totalAdded++;
      }

      // Process modified transactions
      for (const tx of modified) {
        const account = accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;

        await prisma.transaction.updateMany({
          where: { externalId: tx.transaction_id },
          data: {
            amount: -tx.amount,
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

    // Update lastSyncedAt for all accounts
    await prisma.account.updateMany({
      where: { plaidItemId: plaidItem.itemId },
      data: { lastSyncedAt: new Date() },
    });

    console.log(
      `Synced ${totalAdded} added, ${totalModified} modified, ${totalRemoved} removed transactions for item ${plaidItem.itemId}`
    );
  } catch (error) {
    console.error(`Failed to sync transactions for item ${plaidItem.itemId}:`, error);
    throw error;
  }
}

export default router;
