import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { AccountWithOwner, AccountType } from '@otter-money/shared';

// Types for API requests
interface CreateAccountRequest {
  name: string;
  type: AccountType;
  subtype?: string;
  ownerId?: string | null;
  currentBalance: number;
  currency?: string;
  isHidden?: boolean;
  excludeFromBudget?: boolean;
  excludeFromNetWorth?: boolean;
}

interface UpdateAccountRequest {
  name?: string;
  type?: AccountType;
  subtype?: string | null;
  ownerId?: string | null;
  isHidden?: boolean;
  excludeFromBudget?: boolean;
  excludeFromNetWorth?: boolean;
  displayOrder?: number;
}

interface UpdateBalanceRequest {
  newBalance: number;
  note?: string;
}

interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byPartner: Record<string, { assets: number; liabilities: number }>;
}

// Query keys
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: () => [...accountKeys.lists()] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (id: string) => [...accountKeys.details(), id] as const,
  summary: () => [...accountKeys.all, 'summary'] as const,
};

// Hooks
export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.list(),
    queryFn: () => api.get<AccountWithOwner[]>('/accounts'),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => api.get<AccountWithOwner>(`/accounts/${id}`),
    enabled: !!id,
  });
}

export function useAccountSummary() {
  return useQuery({
    queryKey: accountKeys.summary(),
    queryFn: () => api.get<AccountSummary>('/accounts/summary/totals'),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAccountRequest) =>
      api.post<AccountWithOwner>('/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAccountRequest & { id: string }) =>
      api.patch<AccountWithOwner>(`/accounts/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}

export function useUpdateBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBalanceRequest & { id: string }) =>
      api.post<AccountWithOwner>(`/accounts/${id}/balance`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.setQueryData(accountKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: accountKeys.summary() });
    },
  });
}
