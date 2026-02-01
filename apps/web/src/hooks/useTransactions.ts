import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { TransactionWithDetails, AccountType } from '@otter-money/shared';
import { accountKeys } from './useAccounts';
import { dashboardKeys } from './useDashboard';

// Extended transaction type with account owner
export interface TransactionWithOwner extends TransactionWithDetails {
  account: {
    id: string;
    name: string;
    type: AccountType;
    ownerId: string | null;
    owner: { id: string; name: string } | null;
  };
}

interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeAdjustments?: boolean;
}

interface CreateTransactionRequest {
  accountId: string;
  date: string;
  amount: number;
  description: string;
  merchantName?: string;
  categoryId?: string | null;
  notes?: string;
}

interface UpdateTransactionRequest {
  date?: string;
  amount?: number;
  description?: string;
  merchantName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
}

// Query keys
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

// Hooks
export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = {};
      if (filters.accountId) params.accountId = filters.accountId;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.ownerId) params.ownerId = filters.ownerId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.search) params.search = filters.search;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;
      if (filters.includeAdjustments) params.includeAdjustments = 'true';

      const response = await fetch(`/api/transactions?${new URLSearchParams(params as any)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('otter-money-auth') ? JSON.parse(localStorage.getItem('otter-money-auth')!).state.accessToken : ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch transactions');
      const result = await response.json();
      return {
        transactions: result.data as TransactionWithOwner[],
        total: result.meta?.total || 0,
        limit: result.meta?.limit || 50,
        offset: result.meta?.offset || 0,
      };
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => api.get<TransactionWithOwner>(`/transactions/${id}`),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionRequest) =>
      api.post<TransactionWithOwner>('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTransactionRequest & { id: string }) =>
      api.patch<TransactionWithOwner>(`/transactions/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.setQueryData(transactionKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useBulkCategorize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { transactionIds: string[]; categoryId: string | null }) =>
      api.post<{ message: string; count: number }>('/transactions/bulk-categorize', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
    },
  });
}
