import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  householdRole: 'ORGANIZER' | 'PARTNER';
  isCurrentUser: boolean;
}

interface RemovalImpact {
  member: { id: string; name: string; email: string };
  impact: { accountCount: number; transactionCount: number };
}

interface DissolveImpact {
  memberCount: number;
  accountCount: number;
  transactionCount: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, household, accessToken, logout, updateUser, updateHousehold } = useAuthStore();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Remove partner modal
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removalImpact, setRemovalImpact] = useState<RemovalImpact | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Leave household modal (for partners)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Dissolve household modal (for organizers)
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [dissolveImpact, setDissolveImpact] = useState<DissolveImpact | null>(null);
  const [isDissolving, setIsDissolving] = useState(false);

  const isOrganizer = user?.householdRole === 'ORGANIZER';

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
          setMembers(data);
        }

        if (inviteRes.ok) {
          const { data } = await inviteRes.json();
          setInviteUrl(`${window.location.origin}/join/${data.inviteCode}`);
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

  const handleRegenerateInvite = async () => {
    if (!isOrganizer) return;
    setIsRegenerating(true);

    try {
      const res = await fetch('/api/household/invite/regenerate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const { data } = await res.json();
        setInviteUrl(`${window.location.origin}/join/${data.inviteCode}`);
      }
    } catch (err) {
      console.error('Failed to regenerate invite:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRemovePartnerClick = async (partnerId: string) => {
    if (!isOrganizer) return;

    try {
      const res = await fetch(`/api/household/members/${partnerId}/removal-impact`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const { data } = await res.json();
        setRemovalImpact(data);
        setShowRemoveConfirm(true);
      }
    } catch (err) {
      console.error('Failed to get removal impact:', err);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removalImpact) return;
    setIsRemoving(true);

    try {
      const res = await fetch(`/api/household/members/${removalImpact.member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setMembers(members.filter((m) => m.id !== removalImpact.member.id));
        setShowRemoveConfirm(false);
        setRemovalImpact(null);
      }
    } catch (err) {
      console.error('Failed to remove partner:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  // Partner leaves household
  const handleLeaveClick = () => {
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeave = async () => {
    setIsLeaving(true);

    try {
      const res = await fetch('/api/household/leave', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        // Update auth state - user no longer has a household
        updateUser({ householdId: null, householdRole: 'PARTNER' });
        updateHousehold(null as any);
        // Will redirect to NoHousehold via ProtectedRoute
      }
    } catch (err) {
      console.error('Failed to leave household:', err);
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  // Organizer dissolves household
  const handleDissolveClick = async () => {
    try {
      const res = await fetch('/api/household/dissolve/impact', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const { data } = await res.json();
        setDissolveImpact(data.impact);
        setShowDissolveConfirm(true);
      }
    } catch (err) {
      console.error('Failed to get dissolve impact:', err);
    }
  };

  const handleConfirmDissolve = async () => {
    setIsDissolving(true);

    try {
      const res = await fetch('/api/household/dissolve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        // Update auth state - user no longer has a household
        updateUser({ householdId: null, householdRole: 'PARTNER' });
        updateHousehold(null as any);
        // Will redirect to NoHousehold via ProtectedRoute
      }
    } catch (err) {
      console.error('Failed to dissolve household:', err);
    } finally {
      setIsDissolving(false);
      setShowDissolveConfirm(false);
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
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{user?.name}</p>
              {isOrganizer && (
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary">
                  Organizer
                </span>
              )}
            </div>
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
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary">
                    {partner?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{partner?.name}</p>
                    <p className="text-sm text-gray-500">{partner?.email}</p>
                  </div>
                </div>
                {isOrganizer && partner && (
                  <button
                    onClick={() => handleRemovePartnerClick(partner.id)}
                    className="text-sm text-error-600 hover:text-error-700"
                  >
                    Remove
                  </button>
                )}
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
                <button onClick={handleCopyInvite} className="btn-secondary shrink-0">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isOrganizer && (
                <button
                  onClick={handleRegenerateInvite}
                  disabled={isRegenerating}
                  className="mt-2 text-sm text-primary hover:text-primary-600 disabled:opacity-50"
                >
                  {isRegenerating ? 'Regenerating...' : 'Generate new invite link'}
                </button>
              )}
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

      {/* Danger Zone */}
      <section className="card border-error-200">
        <h2 className="mb-4 text-lg font-semibold text-error-600">Danger Zone</h2>
        <div className="space-y-3">
          {isOrganizer ? (
            <div>
              <p className="text-sm text-gray-600">
                Dissolving your household will permanently delete all accounts, transactions, budgets, and goals.
                {hasPartner && ' Your partner will also lose access.'}
              </p>
              <button
                onClick={handleDissolveClick}
                className="mt-3 w-full rounded-lg border border-error-300 py-2 text-sm font-medium text-error-600 hover:bg-error-50"
              >
                Dissolve Household
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600">
                Leaving the household will remove your access. Your accounts will become joint accounts managed by the organizer.
              </p>
              <button
                onClick={handleLeaveClick}
                className="mt-3 w-full rounded-lg border border-error-300 py-2 text-sm font-medium text-error-600 hover:bg-error-50"
              >
                Leave Household
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        className="w-full rounded-lg border border-gray-300 py-3 font-medium text-gray-600 hover:bg-gray-50"
      >
        Sign out
      </button>

      {/* Remove Partner Confirmation Modal */}
      {showRemoveConfirm && removalImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">Remove Partner?</h3>
            <p className="mt-2 text-sm text-gray-600">
              You're about to remove <strong>{removalImpact.member.name}</strong> from your household.
            </p>

            {(removalImpact.impact.accountCount > 0 || removalImpact.impact.transactionCount > 0) && (
              <div className="mt-4 rounded-lg bg-warning-50 p-3">
                <p className="text-sm text-warning-800">
                  <strong>Heads up:</strong> {removalImpact.member.name} has{' '}
                  {removalImpact.impact.accountCount > 0 && (
                    <>{removalImpact.impact.accountCount} account{removalImpact.impact.accountCount !== 1 ? 's' : ''}</>
                  )}
                  {removalImpact.impact.accountCount > 0 && removalImpact.impact.transactionCount > 0 && ' and '}
                  {removalImpact.impact.transactionCount > 0 && (
                    <>{removalImpact.impact.transactionCount} transaction{removalImpact.impact.transactionCount !== 1 ? 's' : ''}</>
                  )}
                  {' '}linked to them. These will become joint records that you'll manage going forward.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setRemovalImpact(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="flex-1 rounded-lg bg-error-600 py-2 font-medium text-white hover:bg-error-700 disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Remove Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Household Confirmation Modal (for partners) */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">Leave Household?</h3>
            <p className="mt-2 text-sm text-gray-600">
              You're about to leave <strong>{household?.name}</strong>.
            </p>

            <div className="mt-4 rounded-lg bg-warning-50 p-3">
              <p className="text-sm text-warning-800">
                <strong>What happens next:</strong> Your accounts will become joint accounts managed by the organizer.
                You can create a new household or join another one after leaving.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLeave}
                disabled={isLeaving}
                className="flex-1 rounded-lg bg-error-600 py-2 font-medium text-white hover:bg-error-700 disabled:opacity-50"
              >
                {isLeaving ? 'Leaving...' : 'Leave Household'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dissolve Household Confirmation Modal (for organizers) */}
      {showDissolveConfirm && dissolveImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-semibold text-error-600">Dissolve Household?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action <strong>cannot be undone</strong>. All data will be permanently deleted.
            </p>

            <div className="mt-4 rounded-lg bg-error-50 p-3">
              <p className="text-sm text-error-800">
                <strong>The following will be deleted:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-error-700">
                {dissolveImpact.memberCount > 1 && (
                  <li>• {dissolveImpact.memberCount - 1} partner will lose access</li>
                )}
                {dissolveImpact.accountCount > 0 && (
                  <li>• {dissolveImpact.accountCount} account{dissolveImpact.accountCount !== 1 ? 's' : ''}</li>
                )}
                {dissolveImpact.transactionCount > 0 && (
                  <li>• {dissolveImpact.transactionCount} transaction{dissolveImpact.transactionCount !== 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowDissolveConfirm(false);
                  setDissolveImpact(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDissolve}
                disabled={isDissolving}
                className="flex-1 rounded-lg bg-error-600 py-2 font-medium text-white hover:bg-error-700 disabled:opacity-50"
              >
                {isDissolving ? 'Dissolving...' : 'Dissolve Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
