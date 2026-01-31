import { Link } from 'react-router-dom';
import { useUpcomingBills, formatFrequency } from '../hooks/useRecurring';

export default function UpcomingBillsWidget() {
  const { data: bills, isLoading } = useUpcomingBills(30, 5);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Bills</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bills || bills.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Bills</h3>
        <p className="text-gray-500 text-sm">No upcoming bills detected.</p>
        <Link
          to="/recurring"
          className="text-purple-600 text-sm hover:text-purple-700 mt-2 inline-block"
        >
          Set up recurring transactions
        </Link>
      </div>
    );
  }

  const formatDueDate = (daysUntilDue: number): string => {
    if (daysUntilDue === 0) return 'Today';
    if (daysUntilDue === 1) return 'Tomorrow';
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue <= 7) return `${daysUntilDue} days`;
    return new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDueBadgeColor = (daysUntilDue: number): string => {
    if (daysUntilDue < 0) return 'bg-red-100 text-red-700';
    if (daysUntilDue === 0) return 'bg-amber-100 text-amber-700';
    if (daysUntilDue <= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Bills</h3>
        <Link
          to="/recurring"
          className="text-purple-600 text-sm hover:text-purple-700"
        >
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {bills.map((bill) => (
          <div key={bill.id} className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate capitalize">
                  {bill.merchantName}
                </span>
                {bill.categoryColor && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bill.categoryColor }}
                    title={bill.categoryName || undefined}
                  />
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatFrequency(bill.frequency)}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <div className="font-semibold text-gray-900">
                ${bill.expectedAmount.toFixed(2)}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${getDueBadgeColor(bill.daysUntilDue)}`}
              >
                {formatDueDate(bill.daysUntilDue)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {bills.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total due next 30 days</span>
            <span className="font-semibold text-gray-900">
              ${bills.reduce((sum, bill) => sum + bill.expectedAmount, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
