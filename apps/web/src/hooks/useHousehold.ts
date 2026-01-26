import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { HouseholdMember } from '@otter-money/shared';

export const householdKeys = {
  all: ['household'] as const,
  members: () => [...householdKeys.all, 'members'] as const,
};

export function useHouseholdMembers() {
  return useQuery({
    queryKey: householdKeys.members(),
    queryFn: () => api.get<HouseholdMember[]>('/household/members'),
  });
}
