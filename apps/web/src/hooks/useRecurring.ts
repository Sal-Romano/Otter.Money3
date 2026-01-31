import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type {
  RecurringFrequency,
  RecurringStatus,
  CreateRecurringTransactionRequest,
  UpdateRecurringTransactionRequest,
  MarkRecurringRequest,
  UpcomingBill,
} from '@otter-money/shared';

export interface RecurringTransaction {
  id: string;
  householdId: string;
  merchantName: string;
  description: string | null;
  frequency: RecurringFrequency;
  expectedAmount: number;
  amountVariance: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextExpectedDate: string;
  lastOccurrence: string | null;
  accountId: string | null;
  categoryId: string | null;
  status: RecurringStatus;
  isManual: boolean;
  isPaused: boolean;
  occurrenceCount: number;
  confidence: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    name: string;
    type: string;
    ownerId: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    type: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export interface RecurringTransactionWithLinks extends RecurringTransaction {
  linkedTransactions: Array<{
    id: string;
    date: string;
    amount: number;
    merchantName: string | null;
    description: string;
  }>;
}

export interface DetectionResult {
  detected: number;
  updated: number;
  message: string;
}

// Query keys
export const recurringKeys = {
  all: ['recurring'] as const,
  lists: () => [...recurringKeys.all, 'list'] as const,
  list: (filters?: { status?: string; isPaused?: boolean }) =>
    [...recurringKeys.lists(), filters] as const,
  detail: (id: string) => [...recurringKeys.all, 'detail', id] as const,
  upcoming: (days?: number) => [...recurringKeys.all, 'upcoming', days] as const,
};

// Helper to format frequency for display
export function formatFrequency(frequency: RecurringFrequency): string {
  switch (frequency) {
    case 'WEEKLY':
      return 'Weekly';
    case 'BIWEEKLY':
      return 'Every 2 weeks';
    case 'MONTHLY':
      return 'Monthly';
    case 'QUARTERLY':
      return 'Quarterly';
    case 'SEMIANNUAL':
      return 'Every 6 months';
    case 'ANNUAL':
      return 'Yearly';
    default:
      return frequency;
  }
}

// Helper to format status for display
export function formatStatus(status: RecurringStatus): string {
  switch (status) {
    case 'DETECTED':
      return 'Needs Review';
    case 'CONFIRMED':
      return 'Active';
    case 'DISMISSED':
      return 'Dismissed';
    case 'ENDED':
      return 'Ended';
    default:
      return status;
  }
}

// Helper to get status color
export function getStatusColor(status: RecurringStatus): string {
  switch (status) {
    case 'DETECTED':
      return '#f59e0b'; // amber
    case 'CONFIRMED':
      return '#10b981'; // green
    case 'DISMISSED':
      return '#6b7280'; // gray
    case 'ENDED':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

// Hooks
export function useRecurringTransactions(filters?: {
  status?: RecurringStatus;
  isPaused?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.isPaused !== undefined) params.append('isPaused', String(filters.isPaused));

  const queryString = params.toString();

  return useQuery({
    queryKey: recurringKeys.list(filters),
    queryFn: () =>
      api.get<RecurringTransaction[]>(`/recurring${queryString ? `?${queryString}` : ''}`),
  });
}

export function useRecurringTransaction(id: string) {
  return useQuery({
    queryKey: recurringKeys.detail(id),
    queryFn: () => api.get<RecurringTransactionWithLinks>(`/recurring/${id}`),
    enabled: !!id,
  });
}

export function useUpcomingBills(days: number = 30, limit: number = 5) {
  return useQuery({
    queryKey: recurringKeys.upcoming(days),
    queryFn: () => api.get<UpcomingBill[]>(`/recurring/upcoming?days=${days}&limit=${limit}`),
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecurringTransactionRequest) =>
      api.post<RecurringTransaction>('/recurring', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateRecurringTransactionRequest & { id: string }) =>
      api.patch<RecurringTransaction>(`/recurring/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(variables.id) });
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}

export function useConfirmRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<RecurringTransaction>(`/recurring/${id}/confirm`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(id) });
    },
  });
}

export function useDismissRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<RecurringTransaction>(`/recurring/${id}/dismiss`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(id) });
    },
  });
}

export function usePauseRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<RecurringTransaction>(`/recurring/${id}/pause`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(id) });
    },
  });
}

export function useResumeRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<RecurringTransaction>(`/recurring/${id}/resume`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(id) });
    },
  });
}

export function useEndRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<RecurringTransaction>(`/recurring/${id}/end`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: recurringKeys.detail(id) });
    },
  });
}

export function useDetectRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<DetectionResult>('/recurring/detect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
    },
  });
}

export function useMarkAsRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, ...data }: MarkRecurringRequest & { transactionId: string }) =>
      api.post<RecurringTransaction>(`/recurring/from-transaction/${transactionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
