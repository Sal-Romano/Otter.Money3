import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Request failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary-50 px-4">
        <div className="mb-8 text-center">
          <img
            src="/images/otters_logo_vector_nobg.svg"
            alt="Otter Money"
            className="mx-auto h-24 w-24"
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 max-w-sm text-gray-600">
            If an account exists for {email}, you'll receive a password reset link shortly.
          </p>
        </div>

        <Link to="/login" className="btn-primary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-50 px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/images/otters_logo_vector_nobg.svg"
          alt="Otter Money"
          className="mx-auto h-24 w-24"
        />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Forgot password?</h1>
        <p className="mt-1 text-gray-600">Enter your email to reset it</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600">{error}</div>
        )}

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

        <button type="submit" disabled={isLoading} className="btn-primary w-full">
          {isLoading ? 'Sending...' : 'Send reset link'}
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
