import { useState } from 'react';
import { useMarkAsRecurring, formatFrequency } from '../hooks/useRecurring';
import type { RecurringFrequency } from '@otter-money/shared';
import type { TransactionWithDetails } from '@otter-money/shared';

interface MarkRecurringModalProps {
  transaction: TransactionWithDetails;
  onClose: () => void;
}

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMIANNUAL', label: 'Every 6 months' },
  { value: 'ANNUAL', label: 'Yearly' },
];

export default function MarkRecurringModal({ transaction, onClose }: MarkRecurringModalProps) {
  const markAsRecurring = useMarkAsRecurring();

  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [expectedAmount, setExpectedAmount] = useState(
    Math.abs(Number(transaction.amount)).toString()
  );
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await markAsRecurring.mutateAsync({
        transactionId: transaction.id,
        frequency,
        expectedAmount: expectedAmount ? parseFloat(expectedAmount) : undefined,
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : undefined,
        dayOfWeek: dayOfWeek ? parseInt(dayOfWeek) : undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark as recurring');
    }
  };

  const merchantName = transaction.merchantName || transaction.description;
  const showDayOfMonth = frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'SEMIANNUAL' || frequency === 'ANNUAL';
  const showDayOfWeek = frequency === 'WEEKLY' || frequency === 'BIWEEKLY';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Mark as Recurring
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Set up <span className="font-medium">{merchantName}</span> as a recurring transaction
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How often does this occur?
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Based on this transaction: ${Math.abs(Number(transaction.amount)).toFixed(2)}
              </p>
            </div>

            {/* Day Selection */}
            {showDayOfMonth && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month (optional)
                </label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Detect automatically</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showDayOfWeek && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week (optional)
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Detect automatically</option>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}

            {/* Preview */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800">
                This will create a {formatFrequency(frequency).toLowerCase()} recurring transaction
                for <span className="font-medium">{merchantName}</span> at ${expectedAmount ? parseFloat(expectedAmount).toFixed(2) : Math.abs(Number(transaction.amount)).toFixed(2)}.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={markAsRecurring.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {markAsRecurring.isPending ? 'Saving...' : 'Mark as Recurring'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
