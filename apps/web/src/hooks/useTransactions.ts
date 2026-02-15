import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '../utils/api';
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
  infinite: (filters: TransactionFilters) => [...transactionKeys.all, 'infinite', filters] as const,
  uncategorizedCount: () => [...transactionKeys.all, 'uncategorized-count'] as const,
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

      const response = await fetch(`${API_BASE}/transactions?${new URLSearchParams(params as any)}`, {
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

function buildParams(filters: TransactionFilters, offset?: number): URLSearchParams {
  const params: Record<string, string> = {};
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.ownerId) params.ownerId = filters.ownerId;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.search) params.search = filters.search;
  if (filters.limit) params.limit = String(filters.limit);
  if (offset !== undefined) params.offset = String(offset);
  if (filters.includeAdjustments) params.includeAdjustments = 'true';
  return new URLSearchParams(params);
}

function getAuthHeader(): Record<string, string> {
  const stored = localStorage.getItem('otter-money-auth');
  const token = stored ? JSON.parse(stored).state.accessToken : '';
  return { Authorization: `Bearer ${token}` };
}

export function useInfiniteTransactions(filters: Omit<TransactionFilters, 'offset'> & { limit: number }) {
  return useInfiniteQuery({
    queryKey: transactionKeys.infinite(filters),
    queryFn: async ({ pageParam = 0 }) => {
      const params = buildParams({ ...filters, limit: filters.limit }, pageParam);
      const response = await fetch(`${API_BASE}/transactions?${params}`, {
        headers: getAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const result = await response.json();
      return {
        transactions: result.data as TransactionWithOwner[],
        total: result.meta?.total || 0,
        limit: result.meta?.limit || filters.limit,
        offset: result.meta?.offset || 0,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
}

export function useUncategorizedCount() {
  return useQuery({
    queryKey: transactionKeys.uncategorizedCount(),
    queryFn: async () => {
      const params = new URLSearchParams({ categoryId: 'uncategorized', limit: '1' });
      const response = await fetch(`${API_BASE}/transactions?${params}`, {
        headers: getAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to fetch uncategorized count');
      const result = await response.json();
      return result.meta?.total || 0;
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
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
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
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
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
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
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
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
