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

  return { items, fetchItems, removeItem, isLoading, error };
}
