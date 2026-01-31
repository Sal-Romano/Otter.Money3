import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendDataPoint } from '../hooks/useAnalytics';
import { formatPeriod } from '../hooks/useAnalytics';

interface SpendingTrendsChartProps {
  data: TrendDataPoint[];
  showIncome?: boolean;
  showNetCashFlow?: boolean;
  chartType?: 'bar' | 'line';
}

export function SpendingTrendsChart({
  data,
  showIncome = false,
  showNetCashFlow = false,
  chartType = 'bar',
}: SpendingTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">📈</p>
          <p>No trend data available</p>
        </div>
      </div>
    );
  }

  // Prepare data for chart
  const chartData = data.map((point) => ({
    period: point.period,
    periodLabel: formatPeriod(point.period).split(' ')[0], // Just month name
    expense: point.totalExpense,
    income: point.totalIncome,
    netCashFlow: point.netCashFlow,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">
            {formatPeriod(payload[0].payload.period)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-medium">
                ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="periodLabel"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="expense"
            name="Expense"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          {showIncome && (
            <Line
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {showNetCashFlow && (
            <Line
              type="monotone"
              dataKey="netCashFlow"
              name="Net Cash Flow"
              stroke="#9F6FBA"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="periodLabel"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#d1d5db' }}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#d1d5db' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '14px' }}
        />
        <Bar
          dataKey="expense"
          name="Expense"
          fill="#EF4444"
          radius={[4, 4, 0, 0]}
        />
        {showIncome && (
          <Bar
            dataKey="income"
            name="Income"
            fill="#10B981"
            radius={[4, 4, 0, 0]}
          />
        )}
        {showNetCashFlow && (
          <Bar
            dataKey="netCashFlow"
            name="Net Cash Flow"
            fill="#9F6FBA"
            radius={[4, 4, 0, 0]}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Compact trends summary (for dashboard)
export function TrendsSummary({ data }: { data: TrendDataPoint[] }) {
  if (!data || data.length < 2) {
    return null;
  }

  const current = data[data.length - 1];
  const previous = data[data.length - 2];

  const expenseChange = current.totalExpense - previous.totalExpense;
  const expenseChangePercent = previous.totalExpense > 0
    ? ((expenseChange / previous.totalExpense) * 100)
    : 0;

  const isIncrease = expenseChange > 0;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 text-sm ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
        {isIncrease ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        <span className="font-medium">
          {Math.abs(expenseChangePercent).toFixed(1)}%
        </span>
      </div>
      <span className="text-sm text-gray-600">vs last month</span>
    </div>
  );
}
