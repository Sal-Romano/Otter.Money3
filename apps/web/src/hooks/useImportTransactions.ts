import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { transactionKeys } from './useTransactions';
import { accountKeys } from './useAccounts';
import { dashboardKeys } from './useDashboard';
import type { ImportPreviewResponse, ImportExecuteResponse } from '@otter-money/shared';

export function useImportPreview() {
  return useMutation({
    mutationFn: (data: { csvContent: string; defaultAccountId?: string | null }) =>
      api.post<ImportPreviewResponse>('/transactions/import/preview', data),
  });
}

export function useImportExecute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      csvContent: string;
      defaultAccountId?: string | null;
      skipRowNumbers?: number[];
    }) => api.post<ImportExecuteResponse>('/transactions/import/execute', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
