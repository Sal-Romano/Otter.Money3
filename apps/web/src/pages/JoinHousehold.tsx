import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { API_BASE } from '../utils/api';

export default function JoinHousehold() {
  const { inviteCode: urlInviteCode } = useParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(urlInviteCode || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/register/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          inviteCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to join household');
      }

      const { data } = await response.json();
      setAuth(data.user, data.household, data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join household');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-50 px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/images/otters_logo_vector_nobg.svg"
          alt="Otter Money"
          className="mx-auto h-24 w-24"
        />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Join a household</h1>
        <p className="mt-1 text-gray-600">Your partner invited you!</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600">{error}</div>
        )}

        <div>
          <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700">
            Invite code
          </label>
          <input
            id="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="input mt-1"
            placeholder="Enter invite code"
            required
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Your name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1"
            placeholder="Jordan"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
            placeholder="••••••••"
            minLength={8}
            required
          />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full">
          {isLoading ? 'Joining...' : 'Join household'}
        </button>
      </form>

      {/* Links */}
      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primary-600">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-gray-600">
          Want to start fresh?{' '}
          <Link to="/register" className="font-medium text-primary hover:text-primary-600">
            Create household
          </Link>
        </p>
      </div>
    </div>
  );
}
