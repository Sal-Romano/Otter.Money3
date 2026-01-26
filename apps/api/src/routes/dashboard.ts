import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(requireHousehold);

// Get dashboard summary
dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        householdId,
        isHidden: false,
      },
      include: {
        owner: {
          select: { id: true, name: true },
        },
      },
    });

    // Get household members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Calculate totals
    let totalAssets = 0;
    let totalLiabilities = 0;
    const byPartner: Record<string, { assets: number; liabilities: number; netWorth: number }> = {};

    // Initialize partner data
    for (const member of members) {
      byPartner[member.id] = { assets: 0, liabilities: 0, netWorth: 0 };
    }
    byPartner['joint'] = { assets: 0, liabilities: 0, netWorth: 0 };

    for (const account of accounts) {
      if (account.excludeFromNetWorth) continue;

      const balance = Number(account.currentBalance);
      const isLiability = ['CREDIT', 'LOAN', 'MORTGAGE'].includes(account.type);
      const ownerId = account.ownerId || 'joint';

      if (isLiability) {
        totalLiabilities += Math.abs(balance);
        if (byPartner[ownerId]) {
          byPartner[ownerId].liabilities += Math.abs(balance);
        }
      } else {
        totalAssets += balance;
        if (byPartner[ownerId]) {
          byPartner[ownerId].assets += balance;
        }
      }
    }

    // Calculate net worth for each partner
    for (const key of Object.keys(byPartner)) {
      byPartner[key].netWorth = byPartner[key].assets - byPartner[key].liabilities;
    }

    const netWorth = totalAssets - totalLiabilities;

    // Get recent transactions (last 5)
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        account: { householdId },
        isAdjustment: false,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, ownerId: true },
        },
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Serialize transactions
    const serializedTransactions = recentTransactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
    }));

    // Get member name mapping for the response
    const memberNames: Record<string, string> = {};
    for (const member of members) {
      memberNames[member.id] = member.name;
    }
    memberNames['joint'] = 'Joint';

    res.json({
      data: {
        netWorth,
        totalAssets,
        totalLiabilities,
        byPartner,
        memberNames,
        recentTransactions: serializedTransactions,
        accountCount: accounts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get net worth history (for chart)
dashboardRouter.get('/networth/history', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;

    // For now, we'll just return the current net worth
    // In a real implementation, we'd store historical snapshots
    const accounts = await prisma.account.findMany({
      where: {
        householdId,
        isHidden: false,
        excludeFromNetWorth: false,
      },
      select: {
        type: true,
        currentBalance: true,
        ownerId: true,
      },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const account of accounts) {
      const balance = Number(account.currentBalance);
      const isLiability = ['CREDIT', 'LOAN', 'MORTGAGE'].includes(account.type);

      if (isLiability) {
        totalLiabilities += Math.abs(balance);
      } else {
        totalAssets += balance;
      }
    }

    // For now, just return current values
    // In production, we'd store daily/weekly snapshots and return real history
    const today = new Date();
    const netWorth = totalAssets - totalLiabilities;

    // Return just the current month - chart won't render with only 1 point
    // Once we have real historical data, we'll populate this properly
    const history = [
      {
        date: today.toISOString().slice(0, 7),
        total: netWorth,
        assets: totalAssets,
        liabilities: totalLiabilities,
      },
    ];

    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});
