import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Household } from '@otter-money/shared';

interface AuthState {
  user: User | null;
  household: Household | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, household: Household | null, accessToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  updateHousehold: (household: Partial<Household>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      household: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, household, accessToken) =>
        set({
          user,
          household,
          accessToken,
          isAuthenticated: true,
        }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      updateHousehold: (updates) =>
        set((state) => ({
          household: state.household ? { ...state.household, ...updates } : null,
        })),
      logout: () =>
        set({
          user: null,
          household: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'otter-money-auth',
      partialize: (state) => ({
        user: state.user,
        household: state.household,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
