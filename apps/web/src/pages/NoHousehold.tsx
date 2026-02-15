import { useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { API_BASE } from '../utils/api';

export default function NoHousehold() {
  const { user, accessToken, setAuth, logout } = useAuthStore();
  const [mode, setMode] = useState<'choice' | 'join'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateHousehold = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/household/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create household');
      }

      const { data } = await res.json();
      // Update auth state with new household - user becomes ORGANIZER
      setAuth(
        { ...user!, householdId: data.household.id, householdRole: 'ORGANIZER' },
        data.household,
        accessToken!
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/household/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to join household');
      }

      const { data } = await res.json();
      // Update auth state with joined household - user becomes PARTNER
      setAuth(
        { ...user!, householdId: data.household.id, householdRole: 'PARTNER' },
        data.household,
        accessToken!
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex min-h-viewport flex-col items-center justify-center bg-primary-50 px-4">
      <div className="mb-8 text-center">
        <img
          src="/images/otters_logo_vector_nobg.svg"
          alt="Otter Money"
          className="mx-auto h-24 w-24"
        />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
        <p className="mt-2 max-w-sm text-gray-600">
          You're not currently part of a household. Would you like to start fresh or join an existing one?
        </p>
      </div>

      {error && (
        <div className="mb-4 w-full max-w-sm rounded-lg bg-error-50 p-3 text-sm text-error-600">
          {error}
        </div>
      )}

      {mode === 'choice' ? (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleCreateHousehold}
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Creating...' : 'Start a New Household'}
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary w-full">
            Join with Invite Code
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleJoinHousehold} className="w-full max-w-sm space-y-4">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="input mt-1"
              placeholder="Paste invite code here"
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? 'Joining...' : 'Join Household'}
          </button>
          <button
            type="button"
            onClick={() => setMode('choice')}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
