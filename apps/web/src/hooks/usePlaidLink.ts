import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../utils/api';

interface UsePlaidLinkReturn {
  open: () => void;
  ready: boolean;
  error: Error | null;
  isLoading: boolean;
}

interface LinkTokenResponse {
  linkToken: string;
}

interface ExchangeTokenResponse {
  success: boolean;
  itemId: string;
  institutionName?: string;
  accountsCreated: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balance: string;
  }>;
}

interface PreviewResponse {
  tempItemId: string;
  institutionName: string | null;
  plaidAccounts: Array<{
    plaidAccountId: string;
    name: string;
    officialName: string | null;
    type: string;
    subtype: string | null;
    currentBalance: number;
    availableBalance: number | null;
    suggestedMatch: {
      accountId: string;
      accountName: string;
      matchReason: string;
    } | null;
    transactionPreview: {
      totalRows: number;
      summary: { create: number; update: number; skip: number; unchanged: number };
      rows: any[];
    };
  }>;
}

export function usePlaidLinkPreview(
  onSuccess?: (data: PreviewResponse) => void,
  onExit?: () => void
): UsePlaidLinkReturn {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<LinkTokenResponse>('/plaid/link-token');
      setLinkToken(response.linkToken);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch link token:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      try {
        setIsLoading(true);
        const response = await api.post<PreviewResponse>('/plaid/exchange-token-preview', {
          publicToken,
        });
        onSuccess?.(response);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to get preview:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: () => {
      onExit?.();
    },
  });

  const openLink = useCallback(() => {
    if (!linkToken) {
      fetchLinkToken().then(() => {});
    } else {
      open();
    }
  }, [linkToken, open, fetchLinkToken]);

  useEffect(() => {
    fetchLinkToken();
  }, [fetchLinkToken]);

  return {
    open: openLink,
    ready: ready && !!linkToken,
    error,
    isLoading,
  };
}

export function usePlaidLinkConnect(
  onSuccess?: (data: ExchangeTokenResponse) => void,
  onExit?: () => void
): UsePlaidLinkReturn {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch link token when hook is used
  const fetchLinkToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<LinkTokenResponse>('/plaid/link-token');
      setLinkToken(response.linkToken);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch link token:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle successful Link flow
  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      try {
        setIsLoading(true);
        const response = await api.post<ExchangeTokenResponse>('/plaid/exchange-token', {
          publicToken,
        });
        onSuccess?.(response);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to exchange token:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: () => {
      onExit?.();
    },
  });

  // Override open to fetch token first if not available
  const openLink = useCallback(() => {
    if (!linkToken) {
      fetchLinkToken().then(() => {
        // Token will be set, triggering re-render, but we don't open here
        // User needs to click again
      });
    } else {
      open();
    }
  }, [linkToken, open, fetchLinkToken]);

  // Auto-fetch token on mount
  useEffect(() => {
    fetchLinkToken();
  }, [fetchLinkToken]);

  return {
    open: openLink,
    ready: ready && !!linkToken,
    error,
    isLoading,
  };
}

// Hook to sync transactions for a Plaid item
export function usePlaidSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const syncTransactions = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<{ added: number; modified: number; removed: number }>(
        '/plaid/sync-transactions',
        { itemId }
      );
      return response;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to sync transactions:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { syncTransactions, isLoading, error };
}

// Hook to get Plaid items
export function usePlaidItems() {
  const [items, setItems] = useState<Array<{ itemId: string; institutionName?: string; createdAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<{ items: typeof items }>('/plaid/items');
      setItems(response.items);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch Plaid items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.delete<{
        success: boolean;
        accountsDeleted: number;
        transactionsDeleted: number;
      }>(`/plaid/items/${itemId}`);
      setItems((prev) => prev.filter((item) => item.itemId !== itemId));
      return response;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to remove Plaid item:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectItem = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<{
        success: boolean;
        accountsDisconnected: number;
        transactionsPreserved: number;
      }>(`/plaid/items/${itemId}/disconnect`);
      setItems((prev) => prev.filter((item) => item.itemId !== itemId));
      return response;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to disconnect Plaid item:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { items, fetchItems, removeItem, disconnectItem, isLoading, error };
}

// Hook to get details of a specific Plaid item
export function usePlaidItemDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getItemDetails = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<{
        itemId: string;
        institutionName: string | null;
        createdAt: string;
        userId: string;
        userName: string;
        accounts: Array<{
          id: string;
          name: string;
          officialName: string | null;
          type: string;
          connectionStatus: string;
          plaidAccountId: string | null;
          lastSyncedAt: string | null;
          currentBalance: number;
        }>;
      }>(`/plaid/items/${itemId}/details`);
      return response;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch Plaid item details:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getItemDetails, isLoading, error };
}

// Hook for Plaid reconnect preview + execute flow
export function usePlaidReconnect() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getPreview = useCallback(async (publicToken: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<{
        tempItemId: string;
        institutionName: string | null;
        plaidAccounts: Array<{
          plaidAccountId: string;
          name: string;
          officialName: string | null;
          type: string;
          subtype: string | null;
          currentBalance: number;
          availableBalance: number | null;
          suggestedMatch: {
            accountId: string;
            accountName: string;
            matchReason: string;
          } | null;
          transactionPreview: {
            totalRows: number;
            summary: { create: number; update: number; skip: number; unchanged: number };
            rows: any[];
          };
        }>;
      }>('/plaid/exchange-token-preview', { publicToken });
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const execute = useCallback(async (params: {
    tempItemId: string;
    mappings: Array<{
      plaidAccountId: string;
      existingAccountId: string | null;
      skipTransactionIds: string[];
    }>;
  }) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post<{
        success: boolean;
        accountsLinked: number;
        accountsCreated: number;
        transactionsAdded: number;
        transactionsSkipped: number;
      }>('/plaid/exchange-token-execute', params);
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getPreview, execute, isLoading, error };
}
