import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import type { CategorizationRuleWithCategory, RuleConditions } from '@otter-money/shared';
import { API_BASE } from '../utils/api';

interface CreateRuleRequest {
  categoryId: string;
  conditions: RuleConditions;
  priority?: number;
  isEnabled?: boolean;
}

interface UpdateRuleRequest {
  categoryId?: string;
  conditions?: RuleConditions;
  priority?: number;
  isEnabled?: boolean;
}

interface TestRuleResponse {
  matchCount: number;
  sampleMatches: any[];
}

// Fetch all rules
export function useRules() {
  const { accessToken } = useAuthStore();

  return useQuery<CategorizationRuleWithCategory[]>({
    queryKey: ['rules'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rules`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch rules');
      }

      const { data } = await res.json();
      return data;
    },
    enabled: !!accessToken,
  });
}

// Create rule
export function useCreateRule() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleData: CreateRuleRequest) => {
      const res = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(ruleData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to create rule');
      }

      const { data } = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// Update rule
export function useUpdateRule() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: UpdateRuleRequest }) => {
      const res = await fetch(`${API_BASE}/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to update rule');
      }

      const { data } = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

// Delete rule
export function useDeleteRule() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`${API_BASE}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to delete rule');
      }

      const { data } = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

// Test rule conditions
export function useTestRule() {
  const { accessToken } = useAuthStore();

  return useMutation({
    mutationFn: async ({ conditions, limit }: { conditions: RuleConditions; limit?: number }) => {
      const res = await fetch(`${API_BASE}/rules/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ conditions, limit }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to test rule');
      }

      const { data } = await res.json();
      return data as TestRuleResponse;
    },
  });
}

// Apply rule retroactively
export function useApplyRule() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, force }: { ruleId: string; force?: boolean }) => {
      const url = force ? `/api/rules/${ruleId}/apply?force=true` : `/api/rules/${ruleId}/apply`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to apply rule');
      }

      const { data } = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
