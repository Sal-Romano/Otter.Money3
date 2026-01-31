import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CategorySpending } from '../hooks/useAnalytics';

interface SpendingBreakdownChartProps {
  data: CategorySpending[];
  onCategoryClick?: (categoryId: string) => void;
}

// Generate a color palette - use category colors if available, otherwise use defaults
const DEFAULT_COLORS = [
  '#9F6FBA', // Purple (primary brand)
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export function SpendingBreakdownChart({ data, onCategoryClick }: SpendingBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">📊</p>
          <p>No spending data available</p>
        </div>
      </div>
    );
  }

  // Prepare data for pie chart
  const chartData = data.map((item, index) => ({
    name: item.categoryName,
    value: item.totalAmount,
    percentage: item.percentage,
    categoryId: item.categoryId,
    color: item.categoryColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    icon: item.categoryIcon,
  }));

  // Custom label to show percentage
  const renderLabel = (entry: any) => {
    if (entry.percentage < 5) return ''; // Don't show label if slice is too small
    return `${entry.percentage.toFixed(0)}%`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            {data.icon && <span className="text-xl">{data.icon}</span>}
            <p className="font-semibold text-gray-900">{data.name}</p>
          </div>
          <p className="text-sm text-gray-600">
            ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">{data.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props: any) => {
    const { payload } = props;

    return (
      <div className="flex flex-col gap-2 mt-4">
        {payload.map((entry: any, index: number) => (
          <div
            key={`legend-${index}`}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg ${
              onCategoryClick ? 'cursor-pointer hover:bg-gray-50' : ''
            }`}
            onClick={() => onCategoryClick?.(entry.payload.categoryId)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <div className="flex items-center gap-1 min-w-0">
                {entry.payload.icon && (
                  <span className="text-sm flex-shrink-0">{entry.payload.icon}</span>
                )}
                <span className="text-sm text-gray-700 truncate">{entry.value}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-gray-900">
                ${entry.payload.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-gray-500 w-12 text-right">
                {entry.payload.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            onClick={(data) => {
              if (onCategoryClick) {
                onCategoryClick(data.categoryId);
              }
            }}
            style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Donut chart variant
export function SpendingDonutChart({ data, onCategoryClick }: SpendingBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">📊</p>
          <p>No spending data available</p>
        </div>
      </div>
    );
  }

  // Prepare data for donut chart
  const chartData = data.map((item, index) => ({
    name: item.categoryName,
    value: item.totalAmount,
    percentage: item.percentage,
    categoryId: item.categoryId,
    color: item.categoryColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    icon: item.categoryIcon,
  }));

  // Calculate total for center display
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            {data.icon && <span className="text-xl">{data.icon}</span>}
            <p className="font-semibold text-gray-900">{data.name}</p>
          </div>
          <p className="text-sm text-gray-600">
            ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">{data.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            onClick={(data) => {
              if (onCategoryClick) {
                onCategoryClick(data.categoryId);
              }
            }}
            style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-600">Total Spent</div>
        </div>
      </div>
    </div>
  );
}
