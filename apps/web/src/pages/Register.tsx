import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { API_BASE } from '../utils/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          householdName: householdName || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Registration failed');
      }

      const { data } = await response.json();
      setAuth(data.user, data.household, data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-viewport flex-col items-center justify-center bg-primary-50 px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/images/otters_logo_vector_nobg.svg"
          alt="Otter Money"
          className="mx-auto h-24 w-24"
        />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Create your household</h1>
        <p className="mt-1 text-gray-600">Start managing your finances together</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600">{error}</div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1"
            placeholder="Alex"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
            placeholder="••••••••"
            minLength={8}
            required
          />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
        </div>

        <div>
          <label htmlFor="householdName" className="block text-sm font-medium text-gray-700">
            Household name{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="householdName"
            type="text"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            className="input mt-1"
            placeholder="The Smiths"
          />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full">
          {isLoading ? 'Creating...' : 'Create household'}
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
          Have an invite?{' '}
          <Link to="/join" className="font-medium text-primary hover:text-primary-600">
            Join household
          </Link>
        </p>
      </div>
    </div>
  );
}
