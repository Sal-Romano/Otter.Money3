import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

// Types for analytics API responses
export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
  byPartner: Array<{
    userId: string;
    userName: string;
    amount: number;
    count: number;
  }>;
}

export interface SpendingBreakdownResponse {
  breakdown: CategorySpending[];
  totalSpending: number;
  startDate: string;
  endDate: string;
  period: string | null;
  members: Array<{ id: string; name: string }>;
}

export interface TrendDataPoint {
  period: string;
  totalExpense: number;
  totalIncome: number;
  netCashFlow: number;
  transactionCount: number;
  byPartner: Array<{
    userId: string;
    userName: string;
    expense: number;
    income: number;
  }>;
}

export interface SpendingTrendsResponse {
  trends: TrendDataPoint[];
  members: Array<{ id: string; name: string }>;
}

export interface PeriodSpending {
  period: string;
  totalExpense: number;
  totalIncome: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    categoryColor: string | null;
    totalAmount: number;
    byPartner: Array<{
      userId: string;
      userName: string;
      amount: number;
    }>;
  }>;
}

export interface SpendingComparisonResponse {
  period1: PeriodSpending;
  period2: PeriodSpending;
  comparison: {
    expenseChange: number;
    expenseChangePercent: number;
    incomeChange: number;
    incomeChangePercent: number;
  };
  members: Array<{ id: string; name: string }>;
}

export interface PartnerSpending {
  userId: string;
  userName: string;
  expense: number;
  income: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface SpendingByPartnerResponse {
  period: string;
  byPartner: PartnerSpending[];
  household: {
    totalExpense: number;
    totalIncome: number;
    netCashFlow: number;
  };
}

// Query keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  breakdown: (period?: string, startDate?: string, endDate?: string, ownerId?: string) =>
    [...analyticsKeys.all, 'breakdown', period, startDate, endDate, ownerId] as const,
  trends: (months: number, categoryId?: string, ownerId?: string) =>
    [...analyticsKeys.all, 'trends', months, categoryId, ownerId] as const,
  comparison: (period1: string, period2: string) =>
    [...analyticsKeys.all, 'comparison', period1, period2] as const,
  byPartner: (period: string) =>
    [...analyticsKeys.all, 'by-partner', period] as const,
};

// Hook: Get spending breakdown by category
export function useSpendingBreakdown(
  period?: string,
  startDate?: string,
  endDate?: string,
  ownerId?: string
) {
  return useQuery({
    queryKey: analyticsKeys.breakdown(period, startDate, endDate, ownerId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (ownerId) params.append('ownerId', ownerId);

      return api.get<SpendingBreakdownResponse>(
        `/analytics/spending/breakdown?${params.toString()}`
      );
    },
  });
}

// Hook: Get spending trends over time
export function useSpendingTrends(
  months: number = 6,
  categoryId?: string,
  ownerId?: string
) {
  return useQuery({
    queryKey: analyticsKeys.trends(months, categoryId, ownerId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('months', months.toString());
      if (categoryId) params.append('categoryId', categoryId);
      if (ownerId) params.append('ownerId', ownerId);

      return api.get<SpendingTrendsResponse>(
        `/analytics/spending/trends?${params.toString()}`
      );
    },
  });
}

// Hook: Compare two periods
export function useSpendingComparison(period1: string, period2: string) {
  return useQuery({
    queryKey: analyticsKeys.comparison(period1, period2),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period1', period1);
      params.append('period2', period2);

      return api.get<SpendingComparisonResponse>(
        `/analytics/spending/comparison?${params.toString()}`
      );
    },
    enabled: !!period1 && !!period2,
  });
}

// Hook: Get spending by partner
export function useSpendingByPartner(period: string) {
  return useQuery({
    queryKey: analyticsKeys.byPartner(period),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', period);

      return api.get<SpendingByPartnerResponse>(
        `/analytics/spending/by-partner?${params.toString()}`
      );
    },
    enabled: !!period,
  });
}

// Helper function to get current period
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Helper function to get previous period
export function getPrevPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper function to get next period
export function getNextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper function to format period for display
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
