import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface Budget {
  id: string;
  householdId: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    type: string;
    icon: string | null;
    color: string | null;
  };
  amount: number;
  period: string; // YYYY-MM format
  rollover: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpendingByPartner {
  userId: string;
  userName: string;
  spent: number;
}

export interface BudgetSpending {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgetAmount: number;
  totalSpent: number;
  byPartner: SpendingByPartner[];
  percentUsed: number;
  remaining: number;
  status: 'on-track' | 'warning' | 'exceeded';
}

export interface SpendingResponse {
  data: BudgetSpending[];
  period: string;
  members: Array<{ id: string; name: string }>;
}

export interface CreateBudgetRequest {
  categoryId: string;
  amount: number;
  period: string;
  rollover?: boolean;
}

export interface UpdateBudgetRequest {
  amount?: number;
  rollover?: boolean;
}

export interface CopyBudgetRequest {
  fromPeriod: string;
  toPeriod: string;
}

// Query keys
export const budgetKeys = {
  all: ['budgets'] as const,
  lists: () => [...budgetKeys.all, 'list'] as const,
  list: (period: string) => [...budgetKeys.lists(), period] as const,
  spending: (period: string) => [...budgetKeys.all, 'spending', period] as const,
};

// Helper to get current period
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to get next/prev period
export function getNextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 + 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPrevPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to format period for display
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Hooks
export function useBudgets(period?: string) {
  const currentPeriod = period || getCurrentPeriod();

  return useQuery({
    queryKey: budgetKeys.list(currentPeriod),
    queryFn: () => api.get<Budget[]>(`/budgets?period=${currentPeriod}`),
  });
}

export function useBudgetSpending(period?: string) {
  const currentPeriod = period || getCurrentPeriod();

  return useQuery({
    queryKey: budgetKeys.spending(currentPeriod),
    queryFn: () => api.get<SpendingResponse>(`/budgets/spending?period=${currentPeriod}`),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBudgetRequest) => api.post<Budget>('/budgets', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.list(variables.period) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.spending(variables.period) });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, period: _period, ...data }: UpdateBudgetRequest & { id: string; period: string }) =>
      api.patch<Budget>(`/budgets/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.list(variables.period) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.spending(variables.period) });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; period: string }) =>
      api.delete<{ message: string }>(`/budgets/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.list(variables.period) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.spending(variables.period) });
    },
  });
}

export function useCopyBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CopyBudgetRequest) =>
      api.post<{ message: string; count: number }>('/budgets/copy', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.list(variables.toPeriod) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.spending(variables.toPeriod) });
    },
  });
}
