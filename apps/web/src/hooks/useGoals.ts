import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface Goal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  icon: string | null;
  color: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  percentComplete: number;
  remaining: number;
}

export interface GoalSummary {
  goals: Goal[];
  totalActiveGoals: number;
  completedThisMonth: number;
  totalSaved: number;
  totalTarget: number;
  overallProgress: number;
}

export interface CreateGoalRequest {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateGoalRequest {
  name?: string;
  targetAmount?: number;
  targetDate?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface AddFundsResponse extends Goal {
  amountAdded: number;
  justCompleted: boolean;
}

export interface WithdrawFundsResponse extends Goal {
  amountWithdrawn: number;
}

// Query keys
export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (includeCompleted: boolean) => [...goalKeys.lists(), { includeCompleted }] as const,
  details: () => [...goalKeys.all, 'detail'] as const,
  detail: (id: string) => [...goalKeys.details(), id] as const,
  summary: () => [...goalKeys.all, 'summary'] as const,
};

// Hooks
export function useGoals(includeCompleted = false) {
  return useQuery({
    queryKey: goalKeys.list(includeCompleted),
    queryFn: () =>
      api.get<Goal[]>(`/goals${includeCompleted ? '?includeCompleted=true' : ''}`),
  });
}

export function useGoal(id: string | null) {
  return useQuery({
    queryKey: goalKeys.detail(id || ''),
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  });
}

export function useGoalSummary() {
  return useQuery({
    queryKey: goalKeys.summary(),
    queryFn: () => api.get<GoalSummary>('/goals/summary/dashboard'),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGoalRequest) => api.post<Goal>('/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateGoalRequest & { id: string }) =>
      api.patch<Goal>(`/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useAddFunds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post<AddFundsResponse>(`/goals/${id}/add`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useWithdrawFunds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post<WithdrawFundsResponse>(`/goals/${id}/withdraw`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

// Helper to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper to calculate days until target date
export function getDaysUntilTarget(targetDate: string | null): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper to format target date
export function formatTargetDate(targetDate: string | null): string {
  if (!targetDate) return 'No target date';
  const date = new Date(targetDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Helper to calculate monthly contribution needed
export function getMonthlyContributionNeeded(
  remaining: number,
  targetDate: string | null
): number | null {
  if (!targetDate || remaining <= 0) return null;
  const daysUntil = getDaysUntilTarget(targetDate);
  if (!daysUntil || daysUntil <= 0) return null;
  const monthsUntil = daysUntil / 30;
  if (monthsUntil < 1) return remaining;
  return remaining / monthsUntil;
}

// Default goal icons
export const GOAL_ICONS = [
  { icon: '🏠', label: 'House' },
  { icon: '🚗', label: 'Car' },
  { icon: '✈️', label: 'Travel' },
  { icon: '🎓', label: 'Education' },
  { icon: '💍', label: 'Wedding' },
  { icon: '👶', label: 'Baby' },
  { icon: '💰', label: 'Savings' },
  { icon: '🏖️', label: 'Vacation' },
  { icon: '🎁', label: 'Gift' },
  { icon: '🏥', label: 'Health' },
  { icon: '📱', label: 'Tech' },
  { icon: '🛋️', label: 'Furniture' },
  { icon: '🎉', label: 'Celebration' },
  { icon: '🔧', label: 'Repair' },
  { icon: '📈', label: 'Investment' },
  { icon: '🎯', label: 'Other' },
];

// Default goal colors
export const GOAL_COLORS = [
  { color: '#9F6FBA', label: 'Purple' },
  { color: '#3B82F6', label: 'Blue' },
  { color: '#10B981', label: 'Green' },
  { color: '#F59E0B', label: 'Amber' },
  { color: '#EF4444', label: 'Red' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#8B5CF6', label: 'Violet' },
  { color: '#06B6D4', label: 'Cyan' },
];
