import { getCurrentPeriod, getPrevPeriod, getNextPeriod, formatPeriod } from '../hooks/useAnalytics';

interface DateRangeSelectorProps {
  period: string;
  onPeriodChange: (period: string) => void;
  maxPeriod?: string; // Optional max period (default: current month)
}

export function DateRangeSelector({ period, onPeriodChange, maxPeriod }: DateRangeSelectorProps) {
  const currentPeriod = getCurrentPeriod();
  const max = maxPeriod || currentPeriod;

  const handlePrevious = () => {
    onPeriodChange(getPrevPeriod(period));
  };

  const handleNext = () => {
    const next = getNextPeriod(period);
    if (next <= max) {
      onPeriodChange(next);
    }
  };

  const isAtMax = period >= max;

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        onClick={handlePrevious}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Previous month"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center min-w-[140px]">
        <div className="text-lg font-semibold text-gray-900">{formatPeriod(period)}</div>
      </div>

      <button
        onClick={handleNext}
        disabled={isAtMax}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
          isAtMax
            ? 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        aria-label="Next month"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

interface PeriodSelectorDropdownProps {
  period: string;
  onPeriodChange: (period: string) => void;
  monthsBack?: number; // How many months to show (default: 12)
}

export function PeriodSelectorDropdown({
  period,
  onPeriodChange,
  monthsBack = 12,
}: PeriodSelectorDropdownProps) {
  const currentPeriod = getCurrentPeriod();

  // Generate list of periods
  const periods: string[] = [];
  let currentGen = currentPeriod;
  for (let i = 0; i < monthsBack; i++) {
    periods.push(currentGen);
    currentGen = getPrevPeriod(currentGen);
  }

  return (
    <select
      value={period}
      onChange={(e) => onPeriodChange(e.target.value)}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"
    >
      {periods.map((p) => (
        <option key={p} value={p}>
          {formatPeriod(p)}
        </option>
      ))}
    </select>
  );
}
