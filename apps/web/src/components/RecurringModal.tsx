import { useState, useEffect } from 'react';
import { useCreateRecurring, useUpdateRecurring, type RecurringTransaction } from '../hooks/useRecurring';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import type { RecurringFrequency } from '@otter-money/shared';

interface RecurringModalProps {
  recurring: RecurringTransaction | null;
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

export default function RecurringModal({ recurring, onClose }: RecurringModalProps) {
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const [merchantName, setMerchantName] = useState(recurring?.merchantName || '');
  const [description, setDescription] = useState(recurring?.description || '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(recurring?.frequency || 'MONTHLY');
  const [expectedAmount, setExpectedAmount] = useState(recurring?.expectedAmount?.toString() || '');
  const [amountVariance, setAmountVariance] = useState(recurring?.amountVariance?.toString() || '5');
  const [dayOfMonth, setDayOfMonth] = useState(recurring?.dayOfMonth?.toString() || '');
  const [dayOfWeek, setDayOfWeek] = useState(recurring?.dayOfWeek?.toString() || '');
  const [nextExpectedDate, setNextExpectedDate] = useState('');
  const [accountId, setAccountId] = useState(recurring?.accountId || '');
  const [categoryId, setCategoryId] = useState(recurring?.categoryId || '');
  const [notes, setNotes] = useState(recurring?.notes || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (recurring?.nextExpectedDate) {
      const date = new Date(recurring.nextExpectedDate);
      setNextExpectedDate(date.toISOString().split('T')[0]);
    } else {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      setNextExpectedDate(date.toISOString().split('T')[0]);
    }
  }, [recurring]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!merchantName.trim()) {
      setError('Please enter a merchant name');
      return;
    }

    if (!expectedAmount || parseFloat(expectedAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const data = {
        merchantName: merchantName.trim(),
        description: description.trim() || undefined,
        frequency,
        expectedAmount: parseFloat(expectedAmount),
        amountVariance: parseFloat(amountVariance) || 5,
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : undefined,
        dayOfWeek: dayOfWeek ? parseInt(dayOfWeek) : undefined,
        nextExpectedDate,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        notes: notes.trim() || undefined,
      };

      if (recurring) {
        await updateRecurring.mutateAsync({ id: recurring.id, ...data });
      } else {
        await createRecurring.mutateAsync(data);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save recurring transaction');
    }
  };

  const showDayOfMonth = frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'SEMIANNUAL' || frequency === 'ANNUAL';
  const showDayOfWeek = frequency === 'WEEKLY' || frequency === 'BIWEEKLY';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {recurring ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Merchant Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g., Netflix, Spotify, Rent"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frequency <span className="text-red-500">*</span>
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

            {/* Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variance %
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={amountVariance}
                  onChange={(e) => setAmountVariance(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Allowed amount variation</p>
              </div>
            </div>

            {/* Day Selection */}
            {showDayOfMonth && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month
                </label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Any day</option>
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
                  Day of Week
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Any day</option>
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

            {/* Next Expected Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next Expected Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={nextExpectedDate}
                onChange={(e) => setNextExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account (optional)
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Any account</option>
                {accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category (optional)
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No category</option>
                {categories
                  ?.filter((c) => c.type === 'EXPENSE')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRecurring.isPending || updateRecurring.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {createRecurring.isPending || updateRecurring.isPending
                  ? 'Saving...'
                  : recurring
                    ? 'Update'
                    : 'Add Recurring'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
