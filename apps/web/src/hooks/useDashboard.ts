import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { TransactionWithDetails } from '@otter-money/shared';

interface PartnerBreakdown {
  assets: number;
  liabilities: number;
  netWorth: number;
}

interface DashboardSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  byPartner: Record<string, PartnerBreakdown>;
  memberNames: Record<string, string>;
  recentTransactions: TransactionWithDetails[];
  accountCount: number;
}

interface NetWorthDataPoint {
  date: string;
  total: number;
  assets: number;
  liabilities: number;
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  netWorthHistory: () => [...dashboardKeys.all, 'networth', 'history'] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  });
}

export function useNetWorthHistory() {
  return useQuery({
    queryKey: dashboardKeys.netWorthHistory(),
    queryFn: () => api.get<NetWorthDataPoint[]>('/dashboard/networth/history'),
  });
}
