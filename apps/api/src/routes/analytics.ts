import { Router } from 'express';
import { authenticate, requireHousehold } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);
analyticsRouter.use(requireHousehold);

// Helper to parse period into date range
function getPeriodDateRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  // Use UTC to avoid timezone issues with date-only fields
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

// Helper to get date range from startDate and endDate
function getDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = startDate ? new Date(startDate) : new Date(end);
  if (!startDate) {
    start.setMonth(start.getMonth() - 1); // Default to last month
  }
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

// Helper to get current period
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// GET /analytics/spending/breakdown
// Get spending breakdown by category for a period or date range
analyticsRouter.get('/spending/breakdown', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const ownerId = req.query.ownerId as string | undefined; // Optional partner filter

    // Get date range from period or custom dates
    const { start, end } = period
      ? getPeriodDateRange(period)
      : getDateRange(startDate, endDate);

    // Get household members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Build where clause for transactions
    const whereClause: any = {
      account: {
        householdId,
        excludeFromBudget: false,
      },
      date: {
        gte: start,
        lte: end,
      },
      categoryId: {
        not: null,
      },
      isAdjustment: false,
    };

    // Add partner filter if specified
    if (ownerId) {
      whereClause.account.ownerId = ownerId;
    }

    // Get all expense transactions in this period
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            icon: true,
            color: true,
          },
        },
        account: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    // Group by category
    const spendingByCategory = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryType: string;
        categoryIcon: string | null;
        categoryColor: string | null;
        totalAmount: number;
        transactionCount: number;
        byPartner: Record<string, { amount: number; count: number }>;
      }
    >();

    // Process transactions
    transactions.forEach((transaction) => {
      if (!transaction.categoryId || !transaction.category) return;

      const categoryId = transaction.categoryId;
      const accountOwnerId = transaction.account.ownerId;
      const amount = Math.abs(Number(transaction.amount));
      const isExpense = transaction.category.type === 'EXPENSE';

      // Only count expenses in breakdown (or negative amounts for income/transfer)
      const amountToAdd = isExpense ? amount : 0;

      if (!spendingByCategory.has(categoryId)) {
        const partnersMap: Record<string, { amount: number; count: number }> = {};
        members.forEach((member) => {
          partnersMap[member.id] = { amount: 0, count: 0 };
        });

        spendingByCategory.set(categoryId, {
          categoryId,
          categoryName: transaction.category.name,
          categoryType: transaction.category.type,
          categoryIcon: transaction.category.icon,
          categoryColor: transaction.category.color,
          totalAmount: 0,
          transactionCount: 0,
          byPartner: partnersMap,
        });
      }

      const categoryData = spendingByCategory.get(categoryId)!;
      categoryData.totalAmount += amountToAdd;
      categoryData.transactionCount += 1;

      if (accountOwnerId && categoryData.byPartner[accountOwnerId]) {
        categoryData.byPartner[accountOwnerId].amount += amountToAdd;
        categoryData.byPartner[accountOwnerId].count += 1;
      }
    });

    // Calculate total spending for percentages
    const totalSpending = Array.from(spendingByCategory.values())
      .reduce((sum, cat) => sum + cat.totalAmount, 0);

    // Convert to array with partner details and percentages
    const result = Array.from(spendingByCategory.values())
      .map((data) => ({
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        categoryType: data.categoryType,
        categoryIcon: data.categoryIcon,
        categoryColor: data.categoryColor,
        totalAmount: data.totalAmount,
        percentage: totalSpending > 0 ? (data.totalAmount / totalSpending) * 100 : 0,
        transactionCount: data.transactionCount,
        byPartner: members.map((member) => ({
          userId: member.id,
          userName: member.name,
          amount: data.byPartner[member.id]?.amount || 0,
          count: data.byPartner[member.id]?.count || 0,
        })),
      }))
      .filter((data) => data.totalAmount > 0) // Only include categories with spending
      .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending

    res.json({
      data: {
        breakdown: result,
        totalSpending,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        period: period || null,
        members,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/spending/trends
// Get spending trends over multiple periods (month-by-month)
analyticsRouter.get('/spending/trends', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const months = parseInt(req.query.months as string) || 6; // Default to 6 months
    const categoryId = req.query.categoryId as string | undefined; // Optional category filter
    const ownerId = req.query.ownerId as string | undefined; // Optional partner filter

    // Get household members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Generate period strings for the last N months
    const periods: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    // Fetch data for each period
    const trendsData = await Promise.all(
      periods.map(async (period) => {
        const { start, end } = getPeriodDateRange(period);

        // Build where clause
        const whereClause: any = {
          account: {
            householdId,
            excludeFromBudget: false,
          },
          date: {
            gte: start,
            lte: end,
          },
          categoryId: {
            not: null,
          },
          isAdjustment: false,
        };

        // Add filters
        if (categoryId) {
          whereClause.categoryId = categoryId;
        }
        if (ownerId) {
          whereClause.account.ownerId = ownerId;
        }

        const transactions = await prisma.transaction.findMany({
          where: whereClause,
          include: {
            category: {
              select: {
                type: true,
              },
            },
            account: {
              select: {
                ownerId: true,
              },
            },
          },
        });

        // Calculate totals
        let totalExpense = 0;
        let totalIncome = 0;
        const byPartner: Record<string, { expense: number; income: number }> = {};

        members.forEach((member) => {
          byPartner[member.id] = { expense: 0, income: 0 };
        });

        transactions.forEach((tx) => {
          const amount = Math.abs(Number(tx.amount));
          const accountOwnerId = tx.account.ownerId;

          if (tx.category?.type === 'EXPENSE') {
            totalExpense += amount;
            if (accountOwnerId && byPartner[accountOwnerId]) {
              byPartner[accountOwnerId].expense += amount;
            }
          } else if (tx.category?.type === 'INCOME') {
            totalIncome += amount;
            if (accountOwnerId && byPartner[accountOwnerId]) {
              byPartner[accountOwnerId].income += amount;
            }
          }
        });

        return {
          period,
          totalExpense,
          totalIncome,
          netCashFlow: totalIncome - totalExpense,
          transactionCount: transactions.length,
          byPartner: members.map((member) => ({
            userId: member.id,
            userName: member.name,
            expense: byPartner[member.id]?.expense || 0,
            income: byPartner[member.id]?.income || 0,
          })),
        };
      })
    );

    res.json({
      data: {
        trends: trendsData,
        members,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/spending/comparison
// Compare two periods side by side
analyticsRouter.get('/spending/comparison', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const period1 = (req.query.period1 as string) || getCurrentPeriod();
    const period2 = req.query.period2 as string;

    if (!period2) {
      // Default to previous month
      const [year, month] = period1.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      return res.redirect(`/api/analytics/spending/comparison?period1=${period1}&period2=${prevPeriod}`);
    }

    // Get members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Helper to get spending for a period
    const getPeriodSpending = async (period: string) => {
      const { start, end } = getPeriodDateRange(period);

      const transactions = await prisma.transaction.findMany({
        where: {
          account: {
            householdId,
            excludeFromBudget: false,
          },
          date: {
            gte: start,
            lte: end,
          },
          categoryId: {
            not: null,
          },
          isAdjustment: false,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              icon: true,
              color: true,
            },
          },
          account: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      // Group by category
      const byCategory = new Map<string, { totalAmount: number; byPartner: Record<string, number> }>();
      let totalExpense = 0;
      let totalIncome = 0;

      transactions.forEach((tx) => {
        if (!tx.category) return;

        const categoryId = tx.category.id;
        const amount = Math.abs(Number(tx.amount));
        const accountOwnerId = tx.account.ownerId;

        if (tx.category.type === 'EXPENSE') {
          totalExpense += amount;

          if (!byCategory.has(categoryId)) {
            const partnersMap: Record<string, number> = {};
            members.forEach((m) => (partnersMap[m.id] = 0));
            byCategory.set(categoryId, {
              totalAmount: 0,
              byPartner: partnersMap,
            });
          }

          const catData = byCategory.get(categoryId)!;
          catData.totalAmount += amount;
          if (accountOwnerId && catData.byPartner[accountOwnerId] !== undefined) {
            catData.byPartner[accountOwnerId] += amount;
          }
        } else if (tx.category.type === 'INCOME') {
          totalIncome += amount;
        }
      });

      // Get all categories that appear in this period
      const categories = await prisma.category.findMany({
        where: {
          id: {
            in: Array.from(byCategory.keys()),
          },
        },
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      });

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      return {
        period,
        totalExpense,
        totalIncome,
        byCategory: Array.from(byCategory.entries())
          .map(([categoryId, data]) => {
            const category = categoryMap.get(categoryId);
            return {
              categoryId,
              categoryName: category?.name || 'Unknown',
              categoryIcon: category?.icon || null,
              categoryColor: category?.color || null,
              totalAmount: data.totalAmount,
              byPartner: members.map((member) => ({
                userId: member.id,
                userName: member.name,
                amount: data.byPartner[member.id] || 0,
              })),
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount),
      };
    };

    const [data1, data2] = await Promise.all([
      getPeriodSpending(period1),
      getPeriodSpending(period2),
    ]);

    // Calculate changes
    const expenseChange = data1.totalExpense - data2.totalExpense;
    const expenseChangePercent =
      data2.totalExpense > 0 ? ((expenseChange / data2.totalExpense) * 100) : 0;

    const incomeChange = data1.totalIncome - data2.totalIncome;
    const incomeChangePercent =
      data2.totalIncome > 0 ? ((incomeChange / data2.totalIncome) * 100) : 0;

    res.json({
      data: {
        period1: data1,
        period2: data2,
        comparison: {
          expenseChange,
          expenseChangePercent,
          incomeChange,
          incomeChangePercent,
        },
        members,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/spending/by-partner
// Get spending totals by partner for a period
analyticsRouter.get('/spending/by-partner', async (req, res, next) => {
  try {
    const householdId = req.user!.householdId!;
    const period = (req.query.period as string) || getCurrentPeriod();
    const { start, end } = getPeriodDateRange(period);

    // Get household members
    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true },
    });

    // Get all transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        account: {
          householdId,
          excludeFromBudget: false,
        },
        date: {
          gte: start,
          lte: end,
        },
        categoryId: {
          not: null,
        },
        isAdjustment: false,
      },
      include: {
        category: {
          select: {
            type: true,
          },
        },
        account: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    // Calculate by partner
    const byPartner = members.map((member) => {
      let expense = 0;
      let income = 0;
      let transactionCount = 0;

      transactions.forEach((tx) => {
        if (tx.account.ownerId === member.id) {
          const amount = Math.abs(Number(tx.amount));

          if (tx.category?.type === 'EXPENSE') {
            expense += amount;
          } else if (tx.category?.type === 'INCOME') {
            income += amount;
          }

          transactionCount++;
        }
      });

      return {
        userId: member.id,
        userName: member.name,
        expense,
        income,
        netCashFlow: income - expense,
        transactionCount,
      };
    });

    // Calculate household totals
    const totalExpense = byPartner.reduce((sum, p) => sum + p.expense, 0);
    const totalIncome = byPartner.reduce((sum, p) => sum + p.income, 0);

    res.json({
      data: {
        period,
        byPartner,
        household: {
          totalExpense,
          totalIncome,
          netCashFlow: totalIncome - totalExpense,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
