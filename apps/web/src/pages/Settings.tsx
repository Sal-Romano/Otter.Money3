import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useCategoriesTreeByType, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories';
import { CategoryIcon, CATEGORY_ICON_OPTIONS } from '../components/CategoryIcon';
import { ChevronDown, ChevronRight, Trash2, Plus, Pencil, X, Check } from 'lucide-react';
import type { CategoryType, CategoryTreeNode } from '@otter-money/shared';

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

      {/* Categories */}
      <CategoriesSection />

      {/* Rules */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Categorization Rules</h2>
        <p className="text-sm text-gray-600 mb-4">
          Create rules to automatically categorize transactions based on merchant names, amounts, and more.
        </p>
        <button
          onClick={() => navigate('/rules')}
          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Manage Rules
        </button>
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

// Categories management section with tree view
function CategoriesSection() {
  const { data: expenseTree, isLoading: expenseLoading } = useCategoriesTreeByType('EXPENSE');
  const { data: incomeTree, isLoading: incomeLoading } = useCategoriesTreeByType('INCOME');
  const { data: transferTree, isLoading: transferLoading } = useCategoriesTreeByType('TRANSFER');

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('EXPENSE');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [expandedType, setExpandedType] = useState<CategoryType | null>('EXPENSE');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Edit state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // Preset colors for the color picker
  const colorOptions = [
    '#9F6FBA', // Purple (brand)
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#06B6D4', // Cyan
    '#F97316', // Orange
  ];

  const isLoading = expenseLoading || incomeLoading || transferLoading;

  const toggleCategoryExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        type: newCategoryType,
        parentId: parentCategoryId || undefined,
      });
      setNewCategoryName('');
      setParentCategoryId('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;

    try {
      await deleteCategory.mutateAsync(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleStartEdit = (node: CategoryTreeNode) => {
    setEditingCategoryId(node.id);
    setEditName(node.name);
    setEditIcon(node.icon || '');
    setEditColor(node.color || '');
    setIconSearch('');
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditName('');
    setEditIcon('');
    setEditColor('');
    setShowIconPicker(false);
    setIconSearch('');
  };

  const handleSaveEdit = async () => {
    if (!editingCategoryId || !editName.trim()) return;

    try {
      await updateCategory.mutateAsync({
        id: editingCategoryId,
        name: editName.trim(),
        icon: editIcon || null,
        color: editColor || null,
      });
      handleCancelEdit();
    } catch (err: any) {
      alert(err.message || 'Failed to update category');
    }
  };

  // Get flat list of categories for parent selection
  const getFlatCategories = (tree: CategoryTreeNode[] | undefined): CategoryTreeNode[] => {
    if (!tree) return [];
    const result: CategoryTreeNode[] = [];
    const traverse = (nodes: CategoryTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (depth < 2) { // Can only add children up to depth 2
          result.push(node);
          traverse(node.children, depth + 1);
        }
      }
    };
    traverse(tree, 0);
    return result;
  };

  const getTreeForType = (type: CategoryType) => {
    switch (type) {
      case 'EXPENSE': return expenseTree;
      case 'INCOME': return incomeTree;
      case 'TRANSFER': return transferTree;
      default: return undefined;
    }
  };

  // Render a category node recursively
  const renderCategoryNode = (node: CategoryTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedCategories.has(node.id);
    const isEditing = editingCategoryId === node.id;
    const indentPx = depth * 20;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center justify-between py-2 px-3 hover:bg-gray-50 ${
            node.isSystem ? 'bg-gray-50/50' : ''
          } ${isEditing ? 'bg-purple-50' : ''}`}
          style={{ paddingLeft: `${12 + indentPx}px` }}
        >
          {isEditing ? (
            // Edit mode
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Icon picker button */}
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="flex-shrink-0 w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  style={{ color: editColor || '#6b7280' }}
                  title="Pick icon"
                >
                  {editIcon ? (
                    <CategoryIcon icon={editIcon} size={18} />
                  ) : (
                    <span className="text-gray-400 text-xs">+</span>
                  )}
                </button>

                {/* Name input */}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 text-sm border rounded px-2 py-1 min-w-0"
                  autoFocus
                />

                {/* Save/Cancel buttons */}
                <button
                  onClick={handleSaveEdit}
                  disabled={updateCategory.isPending}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">Color:</span>
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      editColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {editColor && (
                  <button
                    type="button"
                    onClick={() => setEditColor('')}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Icon picker grid */}
              {showIconPicker && (
                <div className="p-2 border rounded-lg bg-white shadow-lg">
                  {/* Icon search */}
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="w-full text-sm border rounded px-2 py-1 mb-2"
                  />
                  <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                    {CATEGORY_ICON_OPTIONS
                      .filter((name) => name.includes(iconSearch.toLowerCase()))
                      .map((iconName) => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => {
                            setEditIcon(iconName);
                            setShowIconPicker(false);
                            setIconSearch('');
                          }}
                          className={`p-2 rounded hover:bg-purple-100 ${
                            editIcon === iconName ? 'bg-purple-100 ring-2 ring-primary' : ''
                          }`}
                          style={{ color: editColor || '#6b7280' }}
                          title={iconName}
                        >
                          <CategoryIcon icon={iconName} size={16} />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // View mode
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Expand/collapse button */}
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCategoryExpand(node.id)}
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-5" />
                )}

                {/* Icon */}
                <span
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
                  style={{
                    backgroundColor: node.color ? `${node.color}20` : '#f3f4f6',
                    color: node.color || '#6b7280',
                  }}
                >
                  <CategoryIcon icon={node.icon} size={14} />
                </span>

                {/* Name */}
                <span className={`text-sm truncate ${node.isSystem ? 'text-gray-600' : 'text-gray-900'}`}>
                  {node.name}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {node.transactionCount || 0}
                </span>

                {/* Edit button - works for all categories */}
                <button
                  onClick={() => handleStartEdit(node)}
                  className="p-1 text-gray-400 hover:text-primary rounded hover:bg-purple-50"
                  title="Edit category"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                {/* Delete button - only for non-system categories */}
                {!node.isSystem && (
                  <button
                    onClick={() => handleDeleteCategory(node.id)}
                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Categories</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary-600"
        >
          {showAddForm ? 'Cancel' : (
            <>
              <Plus className="h-4 w-4" />
              Add Category
            </>
          )}
        </button>
      </div>

      {/* Add category form */}
      {showAddForm && (
        <form onSubmit={handleAddCategory} className="mb-4 p-3 rounded-lg bg-gray-50 space-y-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            className="input"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newCategoryType}
              onChange={(e) => {
                setNewCategoryType(e.target.value as CategoryType);
                setParentCategoryId('');
              }}
              className="input"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            <select
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(e.target.value)}
              className="input"
            >
              <option value="">No parent (top level)</option>
              {getFlatCategories(getTreeForType(newCategoryType)).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {'  '.repeat(cat.depth)}{cat.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!newCategoryName.trim() || createCategory.isPending}
            className="btn-primary w-full"
          >
            {createCategory.isPending ? 'Adding...' : 'Add Category'}
          </button>
        </form>
      )}

      {/* Categories tree by type */}
      <div className="space-y-2">
        {(['EXPENSE', 'INCOME', 'TRANSFER'] as CategoryType[]).map((type) => {
          const tree = getTreeForType(type);
          const isExpanded = expandedType === type;
          const count = tree?.reduce((acc, node) => {
            const countNode = (n: CategoryTreeNode): number =>
              1 + n.children.reduce((sum, child) => sum + countNode(child), 0);
            return acc + countNode(node);
          }, 0) || 0;

          return (
            <div key={type} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-700">
                  {type === 'EXPENSE' ? 'Expenses' : type === 'INCOME' ? 'Income' : 'Transfers'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{count}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                </div>
              </button>

              {isExpanded && tree && (
                <div className="border-t border-gray-200">
                  {tree.map((node) => renderCategoryNode(node))}
                  {tree.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500">No categories</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
