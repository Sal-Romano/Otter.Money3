import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Reset failed');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-viewport flex-col items-center justify-center bg-primary-50 px-4">
        <div className="mb-8 text-center">
          <img
            src="/images/logo-512x-trans.png"
            alt="Otter Money"
            className="mx-auto h-24 w-24"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Invalid link</h1>
          <p className="mt-2 max-w-sm text-gray-600">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <Link to="/forgot-password" className="btn-primary">
          Request new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-viewport flex-col items-center justify-center bg-primary-50 px-4">
        <div className="mb-8 text-center">
          <img
            src="/images/logo-512x-trans.png"
            alt="Otter Money"
            className="mx-auto h-24 w-24"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Password reset</h1>
          <p className="mt-2 max-w-sm text-gray-600">
            Your password has been reset successfully. Redirecting to sign in...
          </p>
        </div>

        <Link to="/login" className="btn-primary">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-viewport flex-col items-center justify-center bg-primary-50 px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/images/logo-512x-trans.png"
          alt="Otter Money"
          className="mx-auto h-24 w-24"
        />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Set new password</h1>
        <p className="mt-1 text-gray-600">Choose a strong password</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600">{error}</div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            New password
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
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input mt-1"
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full">
          {isLoading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      {/* Links */}
      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primary-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
