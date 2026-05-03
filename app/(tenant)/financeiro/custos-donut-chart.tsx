"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#f97316", "#06b6d4", "#ec4899",
  "#84cc16", "#a78bfa",
];

interface Props {
  data: { category: string; total: number }[];
  totalCosts: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-800">{item.name}</p>
      <p className="text-gray-600">{formatCurrency(item.value)}</p>
      <p className="text-gray-400">{item.payload.pct}% do total</p>
    </div>
  );
}

function CustomLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" fontSize="11" fill="#9ca3af">Total</tspan>
      <tspan x={cx} dy="1.4em" fontSize="14" fontWeight="bold" fill="#1f2937">
        {formatCurrency(total)}
      </tspan>
    </text>
  );
}

export function CustosDonutChart({ data, totalCosts }: Props) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.category.replace(/_/g, " "),
    value: d.total,
    pct: totalCosts > 0 ? ((d.total / totalCosts) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Distribuição por Categoria
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Donut */}
        <div className="h-52 w-full sm:w-52 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={({ cx, cy }) => (
                  <CustomLabel cx={cx} cy={cy} total={totalCosts} />
                )}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-1 flex-col gap-2">
          {chartData.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-sm text-gray-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(item.value)}
                </span>
                <span className="w-12 text-right text-xs text-gray-400">
                  {item.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
