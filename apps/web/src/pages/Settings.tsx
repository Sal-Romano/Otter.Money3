import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, household, accessToken, logout } = useAuthStore();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;

      try {
        const [membersRes, inviteRes] = await Promise.all([
          fetch('/api/household/members', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch('/api/household/invite', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (membersRes.ok) {
          const { data } = await membersRes.json();
          setMembers(data.members);
        }

        if (inviteRes.ok) {
          const { data } = await inviteRes.json();
          setInviteUrl(data.inviteUrl);
        }
      } catch (err) {
        console.error('Failed to fetch settings data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [accessToken]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore errors
    }
    logout();
    navigate('/login');
  };

  const partner = members.find((m) => !m.isCurrentUser);
  const hasPartner = members.length > 1;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Your Profile */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Profile</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Household */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Household</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Household Name</label>
            <p className="text-gray-900">{household?.name || 'My Household'}</p>
          </div>

          {hasPartner ? (
            <div>
              <label className="text-sm font-medium text-gray-500">Your Partner</label>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary">
                  {partner?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{partner?.name}</p>
                  <p className="text-sm text-gray-500">{partner?.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-500">Invite Your Partner</label>
              <p className="mt-1 text-sm text-gray-600">
                Share this link with your partner so they can join your household.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="input flex-1 text-sm"
                />
                <button
                  onClick={handleCopyInvite}
                  className="btn-secondary shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">About</h2>
        <div className="flex items-center gap-3">
          <img
            src="/images/otters_logo_vector_nobg.svg"
            alt="Otter Money"
            className="h-12 w-12"
          />
          <div>
            <p className="font-medium text-gray-900">Otter Money</p>
            <p className="text-sm text-gray-500">Finances for couples</p>
          </div>
        </div>
      </section>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        className="w-full rounded-lg border border-error-300 py-3 font-medium text-error-600 hover:bg-error-50"
      >
        Sign out
      </button>
    </div>
  );
}
