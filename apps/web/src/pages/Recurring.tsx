import { useState } from 'react';
import {
  useRecurringTransactions,
  useDeleteRecurring,
  useConfirmRecurring,
  useDismissRecurring,
  usePauseRecurring,
  useResumeRecurring,
  useEndRecurring,
  useDetectRecurring,
  formatFrequency,
  formatStatus,
  getStatusColor,
  type RecurringTransaction,
} from '../hooks/useRecurring';
import RecurringModal from '../components/RecurringModal';
import type { RecurringStatus } from '@otter-money/shared';

type StatusFilter = RecurringStatus | 'ALL';

export default function Recurring() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const { data: recurring, isLoading } = useRecurringTransactions(
    statusFilter === 'ALL' ? undefined : { status: statusFilter }
  );
  const deleteRecurring = useDeleteRecurring();
  const confirmRecurring = useConfirmRecurring();
  const dismissRecurring = useDismissRecurring();
  const pauseRecurring = usePauseRecurring();
  const resumeRecurring = useResumeRecurring();
  const endRecurring = useEndRecurring();
  const detectRecurring = useDetectRecurring();

  const handleCreate = () => {
    setEditingRecurring(null);
    setShowModal(true);
  };

  const handleEdit = (item: RecurringTransaction) => {
    setEditingRecurring(item);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
    try {
      await deleteRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete recurring transaction');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to confirm:', err);
      alert('Failed to confirm');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to dismiss:', err);
      alert('Failed to dismiss');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to pause:', err);
      alert('Failed to pause');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to resume:', err);
      alert('Failed to resume');
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('Mark this as ended? You can still see it in history.')) return;
    try {
      await endRecurring.mutateAsync(id);
    } catch (err) {
      console.error('Failed to end:', err);
      alert('Failed to mark as ended');
    }
  };

  const handleDetect = async () => {
    try {
      const result = await detectRecurring.mutateAsync();
      alert(result.message);
    } catch (err: any) {
      console.error('Failed to detect:', err);
      alert(err.message || 'Failed to detect recurring patterns');
    }
  };

  const formatNextDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff <= 7) return `In ${diff} days`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Group recurring by status
  const grouped = {
    detected: recurring?.filter((r) => r.status === 'DETECTED') || [],
    confirmed: recurring?.filter((r) => r.status === 'CONFIRMED' && !r.isPaused) || [],
    paused: recurring?.filter((r) => r.isPaused) || [],
    dismissed: recurring?.filter((r) => r.status === 'DISMISSED') || [],
    ended: recurring?.filter((r) => r.status === 'ENDED') || [],
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading recurring transactions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Transactions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track subscriptions, bills, and regular payments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDetect}
            disabled={detectRecurring.isPending}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {detectRecurring.isPending ? 'Detecting...' : 'Detect Patterns'}
          </button>
          <button
            onClick={handleCreate}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['ALL', 'DETECTED', 'CONFIRMED', 'DISMISSED', 'ENDED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === status
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'ALL' ? 'All' : formatStatus(status)}
          </button>
        ))}
      </div>

      {!recurring || recurring.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">
            {statusFilter === 'ALL' ? '🔄' : '📭'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {statusFilter === 'ALL'
              ? 'No recurring transactions yet'
              : `No ${formatStatus(statusFilter as RecurringStatus).toLowerCase()} transactions`}
          </h3>
          <p className="text-gray-600 mb-4">
            {statusFilter === 'ALL'
              ? 'Click "Detect Patterns" to find recurring transactions, or add one manually.'
              : 'Try changing the filter to see other recurring transactions.'}
          </p>
          {statusFilter === 'ALL' && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleDetect}
                disabled={detectRecurring.isPending}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Detect Patterns
              </button>
              <button
                onClick={handleCreate}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Add Manually
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Needs Review Section */}
          {grouped.detected.length > 0 && (statusFilter === 'ALL' || statusFilter === 'DETECTED') && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                Needs Review ({grouped.detected.length})
              </h2>
              <div className="space-y-3">
                {grouped.detected.map((item) => (
                  <RecurringCard
                    key={item.id}
                    item={item}
                    formatNextDate={formatNextDate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={handleEnd}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Active Section */}
          {grouped.confirmed.length > 0 && (statusFilter === 'ALL' || statusFilter === 'CONFIRMED') && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Active ({grouped.confirmed.length})
              </h2>
              <div className="space-y-3">
                {grouped.confirmed.map((item) => (
                  <RecurringCard
                    key={item.id}
                    item={item}
                    formatNextDate={formatNextDate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={handleEnd}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Paused Section */}
          {grouped.paused.length > 0 && statusFilter === 'ALL' && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                Paused ({grouped.paused.length})
              </h2>
              <div className="space-y-3">
                {grouped.paused.map((item) => (
                  <RecurringCard
                    key={item.id}
                    item={item}
                    formatNextDate={formatNextDate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={handleEnd}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Dismissed Section */}
          {grouped.dismissed.length > 0 && (statusFilter === 'ALL' || statusFilter === 'DISMISSED') && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                Dismissed ({grouped.dismissed.length})
              </h2>
              <div className="space-y-3">
                {grouped.dismissed.map((item) => (
                  <RecurringCard
                    key={item.id}
                    item={item}
                    formatNextDate={formatNextDate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={handleEnd}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Ended Section */}
          {grouped.ended.length > 0 && (statusFilter === 'ALL' || statusFilter === 'ENDED') && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                Ended ({grouped.ended.length})
              </h2>
              <div className="space-y-3">
                {grouped.ended.map((item) => (
                  <RecurringCard
                    key={item.id}
                    item={item}
                    formatNextDate={formatNextDate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConfirm={handleConfirm}
                    onDismiss={handleDismiss}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={handleEnd}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">How it works:</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>- Click "Detect Patterns" to automatically find recurring transactions</li>
          <li>- Review detected patterns and confirm or dismiss them</li>
          <li>- Active recurring transactions appear in your Upcoming Bills</li>
          <li>- Pause or end subscriptions you've cancelled</li>
        </ul>
      </div>

      {showModal && (
        <RecurringModal
          recurring={editingRecurring}
          onClose={() => {
            setShowModal(false);
            setEditingRecurring(null);
          }}
        />
      )}
    </div>
  );
}

// RecurringCard component
interface RecurringCardProps {
  item: RecurringTransaction;
  formatNextDate: (date: string) => string;
  onEdit: (item: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
}

function RecurringCard({
  item,
  formatNextDate,
  onEdit,
  onDelete,
  onConfirm,
  onDismiss,
  onPause,
  onResume,
  onEnd,
}: RecurringCardProps) {
  const isActive = item.status === 'CONFIRMED' && !item.isPaused;
  const isDetected = item.status === 'DETECTED';

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all ${
        item.isPaused || item.status === 'DISMISSED' || item.status === 'ENDED' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-semibold text-gray-900 capitalize">{item.merchantName}</span>
            {item.category && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: item.category.color ? `${item.category.color}20` : '#f3f4f6',
                  color: item.category.color || '#6b7280',
                }}
              >
                {item.category.icon && <span className="mr-1">{item.category.icon}</span>}
                {item.category.name}
              </span>
            )}
            {item.isPaused && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                Paused
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">${item.expectedAmount.toFixed(2)}</span>
            <span className="mx-2">-</span>
            <span>{formatFrequency(item.frequency)}</span>
            {item.account && (
              <>
                <span className="mx-2">-</span>
                <span>{item.account.name}</span>
              </>
            )}
          </div>

          {(isActive || isDetected) && (
            <div className="text-sm">
              <span className="text-gray-500">Next: </span>
              <span className="font-medium text-gray-700">
                {formatNextDate(item.nextExpectedDate)}
              </span>
            </div>
          )}

          {isDetected && item.confidence > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              Confidence: {Math.round(item.confidence * 100)}% ({item.occurrenceCount} occurrences)
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {isDetected && (
              <>
                <button
                  onClick={() => onConfirm(item.id)}
                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onDismiss(item.id)}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                >
                  Dismiss
                </button>
              </>
            )}
            {isActive && (
              <>
                <button
                  onClick={() => onPause(item.id)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Pause
                </button>
                <button
                  onClick={() => onEnd(item.id)}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                >
                  Mark Ended
                </button>
              </>
            )}
            {item.isPaused && (
              <button
                onClick={() => onResume(item.id)}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => onEdit(item)}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Status indicator */}
        <div className="ml-4">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: getStatusColor(item.status) }}
          />
        </div>
      </div>
    </div>
  );
}
