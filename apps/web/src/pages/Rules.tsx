import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useRules, useDeleteRule, useUpdateRule, useApplyRule } from '../hooks/useRules';
import RuleModal from '../components/RuleModal';
import { CategoryIcon } from '../components/CategoryIcon';
import type { CategorizationRuleWithCategory } from '@otter-money/shared';

export default function Rules() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: rules, isLoading } = useRules();
  const deleteRule = useDeleteRule();
  const updateRule = useUpdateRule();
  const applyRule = useApplyRule();

  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CategorizationRuleWithCategory | null>(null);
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null);
  const [prefillData, setPrefillData] = useState<{ merchant?: string; categoryId?: string } | null>(null);

  // Check for query parameters on mount
  useEffect(() => {
    const merchant = searchParams.get('merchant');
    const categoryId = searchParams.get('category');

    if (merchant || categoryId) {
      setPrefillData({ merchant: merchant || undefined, categoryId: categoryId || undefined });
      setShowModal(true);
      // Clear search params after reading them
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleCreateRule = () => {
    setEditingRule(null);
    setPrefillData(null);
    setShowModal(true);
  };

  const handleEditRule = (rule: CategorizationRuleWithCategory) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await deleteRule.mutateAsync(ruleId);
    } catch (err) {
      console.error('Failed to delete rule:', err);
      toast.error('Failed to delete rule. Please try again.');
    }
  };

  const handleToggleRule = async (rule: CategorizationRuleWithCategory) => {
    try {
      await updateRule.mutateAsync({
        ruleId: rule.id,
        updates: { isEnabled: !rule.isEnabled },
      });
    } catch (err) {
      console.error('Failed to toggle rule:', err);
      toast.error('Failed to toggle rule. Please try again.');
    }
  };

  const handleApplyRule = async (ruleId: string) => {
    const force = confirm(
      'Apply to uncategorized transactions only?\n\n' +
        'Click OK to apply only to uncategorized transactions.\n' +
        'Click Cancel to apply to ALL transactions (will overwrite existing categories).'
    );

    setApplyingRuleId(ruleId);
    try {
      const result = await applyRule.mutateAsync({ ruleId, force: !force });
      toast.success(result.message);
    } catch (err: any) {
      console.error('Failed to apply rule:', err);
      toast.error(err.message || 'Failed to apply rule. Please try again.');
    } finally {
      setApplyingRuleId(null);
    }
  };

  const getConditionsSummary = (rule: CategorizationRuleWithCategory): string => {
    const parts: string[] = [];
    const c = rule.conditions;

    if (c.merchantContains) parts.push(`Merchant contains "${c.merchantContains}"`);
    if (c.merchantExactly) parts.push(`Merchant is "${c.merchantExactly}"`);
    if (c.descriptionContains) parts.push(`Description contains "${c.descriptionContains}"`);
    if (c.descriptionExactly) parts.push(`Description is "${c.descriptionExactly}"`);

    if (c.amountExactly !== undefined) {
      parts.push(`Amount = $${Math.abs(c.amountExactly).toFixed(2)}`);
    } else {
      if (c.amountMin !== undefined) parts.push(`Amount >= $${Math.abs(c.amountMin).toFixed(2)}`);
      if (c.amountMax !== undefined) parts.push(`Amount <= $${Math.abs(c.amountMax).toFixed(2)}`);
    }

    if (c.accountIds && c.accountIds.length > 0) {
      parts.push(`Specific accounts (${c.accountIds.length})`);
    }
    if (c.accountTypes && c.accountTypes.length > 0) {
      parts.push(`Account types: ${c.accountTypes.join(', ')}`);
    }
    if (c.ownerIds && c.ownerIds.length > 0) {
      parts.push(`Specific partners (${c.ownerIds.length})`);
    }

    const operator = c.operator || 'AND';
    return parts.length > 0 ? parts.join(` ${operator} `) : 'No conditions';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading rules...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorization Rules</h1>
          <p className="text-sm text-gray-600 mt-1">
            Automatically categorize transactions based on conditions
          </p>
        </div>
        <button
          onClick={handleCreateRule}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          + New Rule
        </button>
      </div>

      {!rules || rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No rules yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first rule to automatically categorize transactions
          </p>
          <button
            onClick={handleCreateRule}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all ${
                rule.isEnabled ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: rule.category.color ? `${rule.category.color}20` : '#f3f4f6',
                        color: rule.category.color || '#6b7280',
                      }}
                    >
                      <CategoryIcon icon={rule.category.icon} size={14} />
                      {rule.category.name}
                    </span>
                    <span className="text-xs text-gray-500">Priority: {rule.priority}</span>
                    {!rule.isEnabled && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        Disabled
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mb-1">{getConditionsSummary(rule)}</p>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      disabled={updateRule.isPending}
                    >
                      {rule.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleApplyRule(rule.id)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      disabled={applyingRuleId === rule.id || !rule.isEnabled}
                    >
                      {applyingRuleId === rule.id ? 'Applying...' : 'Apply Now'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                      disabled={deleteRule.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">How rules work:</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Rules are applied in order of priority (highest first)</li>
          <li>• The first matching rule determines the category</li>
          <li>• Rules automatically apply to new transactions</li>
          <li>• Use "Apply Now" to categorize existing transactions</li>
        </ul>
      </div>

      {showModal && (
        <RuleModal
          rule={editingRule}
          prefillData={prefillData}
          onClose={() => {
            setShowModal(false);
            setEditingRule(null);
            setPrefillData(null);
          }}
        />
      )}
    </div>
  );
}
