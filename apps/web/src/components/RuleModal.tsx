import { useState } from 'react';
import { useCreateRule, useUpdateRule, useTestRule } from '../hooks/useRules';
import { CategoryPicker } from './CategoryPicker';
import type { CategorizationRuleWithCategory, RuleConditions } from '@otter-money/shared';

interface RuleModalProps {
  rule: CategorizationRuleWithCategory | null;
  prefillData?: { merchant?: string; categoryId?: string } | null;
  onClose: () => void;
}

export default function RuleModal({ rule, prefillData, onClose }: RuleModalProps) {
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const testRule = useTestRule();

  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId || prefillData?.categoryId || null);
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [isEnabled, setIsEnabled] = useState(rule?.isEnabled ?? true);

  // Conditions
  const [merchantContains, setMerchantContains] = useState(rule?.conditions.merchantContains || prefillData?.merchant || '');
  const [descriptionContains, setDescriptionContains] = useState(rule?.conditions.descriptionContains || '');
  const [merchantExactly, setMerchantExactly] = useState(rule?.conditions.merchantExactly || '');
  const [descriptionExactly, setDescriptionExactly] = useState(rule?.conditions.descriptionExactly || '');
  const [amountMin, setAmountMin] = useState(rule?.conditions.amountMin?.toString() || '');
  const [amountMax, setAmountMax] = useState(rule?.conditions.amountMax?.toString() || '');
  const [amountExactly, setAmountExactly] = useState(rule?.conditions.amountExactly?.toString() || '');
  const [operator, setOperator] = useState<'AND' | 'OR'>(rule?.conditions.operator || 'AND');

  const [testResult, setTestResult] = useState<{ matchCount: number } | null>(null);
  const [error, setError] = useState('');

  const buildConditions = (): RuleConditions => {
    const conditions: RuleConditions = { operator };

    if (merchantContains) conditions.merchantContains = merchantContains;
    if (descriptionContains) conditions.descriptionContains = descriptionContains;
    if (merchantExactly) conditions.merchantExactly = merchantExactly;
    if (descriptionExactly) conditions.descriptionExactly = descriptionExactly;

    if (amountExactly) {
      conditions.amountExactly = parseFloat(amountExactly);
    } else {
      if (amountMin) conditions.amountMin = parseFloat(amountMin);
      if (amountMax) conditions.amountMax = parseFloat(amountMax);
    }

    return conditions;
  };

  const hasConditions = () => {
    return (
      merchantContains ||
      descriptionContains ||
      merchantExactly ||
      descriptionExactly ||
      amountMin ||
      amountMax ||
      amountExactly
    );
  };

  const handleTest = async () => {
    if (!hasConditions()) {
      setError('Please add at least one condition');
      return;
    }

    setError('');
    try {
      const result = await testRule.mutateAsync({
        conditions: buildConditions(),
        limit: 5,
      });
      setTestResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to test rule');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    if (!hasConditions()) {
      setError('Please add at least one condition');
      return;
    }

    try {
      const conditions = buildConditions();

      if (rule) {
        await updateRule.mutateAsync({
          ruleId: rule.id,
          updates: { categoryId, conditions, priority, isEnabled },
        });
      } else {
        await createRule.mutateAsync({
          categoryId,
          conditions,
          priority,
          isEnabled,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save rule');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {rule ? 'Edit Rule' : 'Create Rule'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <CategoryPicker
              value={categoryId}
              onChange={setCategoryId}
              categoryType="EXPENSE"
              label="Category"
              allowUncategorized={false}
              placeholder="Select a category..."
            />

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority (higher = evaluated first)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min="-1000"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default is 0. Use higher numbers for more specific rules.
              </p>
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 text-sm font-medium text-gray-700">
                Rule is enabled
              </label>
            </div>

            <hr />

            {/* Conditions */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Conditions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add at least one condition. Multiple conditions are combined with {operator}.
              </p>

              {/* Operator */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition Operator
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as 'AND' | 'OR')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="AND">AND (all must match)</option>
                  <option value="OR">OR (any can match)</option>
                </select>
              </div>

              {/* Merchant Contains */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Merchant Contains
                </label>
                <input
                  type="text"
                  value={merchantContains}
                  onChange={(e) => setMerchantContains(e.target.value)}
                  placeholder="e.g., Starbucks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Case-insensitive substring match</p>
              </div>

              {/* Merchant Exactly */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Merchant Exactly
                </label>
                <input
                  type="text"
                  value={merchantExactly}
                  onChange={(e) => setMerchantExactly(e.target.value)}
                  placeholder="e.g., Starbucks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Case-insensitive exact match</p>
              </div>

              {/* Description Contains */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description Contains
                </label>
                <input
                  type="text"
                  value={descriptionContains}
                  onChange={(e) => setDescriptionContains(e.target.value)}
                  placeholder="e.g., subscription"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Case-insensitive substring match</p>
              </div>

              {/* Description Exactly */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description Exactly
                </label>
                <input
                  type="text"
                  value={descriptionExactly}
                  onChange={(e) => setDescriptionExactly(e.target.value)}
                  placeholder="e.g., Netflix Subscription"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Case-insensitive exact match</p>
              </div>

              {/* Amount Exactly */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount Exactly (for expenses, use negative)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountExactly}
                  onChange={(e) => setAmountExactly(e.target.value)}
                  placeholder="e.g., -4.99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Min
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    placeholder="e.g., -100"
                    disabled={!!amountExactly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Max
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    placeholder="e.g., -10"
                    disabled={!!amountExactly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2 mb-4">
                For expenses: -100 to -10 means between $10 and $100
              </p>
            </div>

            {/* Test Button */}
            <div>
              <button
                type="button"
                onClick={handleTest}
                disabled={testRule.isPending || !hasConditions()}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {testRule.isPending ? 'Testing...' : 'Test Rule (Preview Matches)'}
              </button>

              {testResult && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    ✓ This rule would match <strong>{testResult.matchCount}</strong> existing
                    transaction{testResult.matchCount !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
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
                disabled={createRule.isPending || updateRule.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {createRule.isPending || updateRule.isPending
                  ? 'Saving...'
                  : rule
                    ? 'Update Rule'
                    : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
