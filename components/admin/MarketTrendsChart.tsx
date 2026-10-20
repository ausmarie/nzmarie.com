'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { buildMarketTrendRows, marketTrendChartMinWidth, type TrendChartMode } from '@/lib/market-trend-chart';

const formatYAxis = (value: number) => `$${(value / 1000000).toFixed(2)}M`;

interface SuburbDataPoint {
  median: number | null;
  sales: number;
  days: number | null;
}

interface DataPoint {
  period: string;
  periodRaw: string;
  cityMedian: number | null;
  citySales: number;
  cityDays: number | null;
  suburbs: Record<string, SuburbDataPoint>;
}

interface Props {
  data: DataPoint[];
  suburbs: string[];
  district: string;
  mode: TrendChartMode;
  suburbColors: Record<string, string>;
  showDistrict: boolean;
}

export default function MarketTrendsChart({ data, suburbs, district, mode, suburbColors, showDistrict }: Props) {
  const chartData = buildMarketTrendRows(data, suburbs, mode);
  const minWidth = marketTrendChartMinWidth(chartData.length, mode);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">
        {suburbs.join(', ')}{showDistrict ? ` vs ${district}` : ''} {mode === 'monthly' ? 'Monthly' : 'Quarterly'} Median Price
      </h3>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="_label"
                angle={-20}
                textAnchor="end"
                height={70}
                interval={0}
                tickMargin={8}
              />
              <YAxis type="number" domain={['auto', 'auto']} tickFormatter={formatYAxis} tickCount={6} />
              <Tooltip
                formatter={(value, name) => {
                  if (typeof value !== 'number') return [value, name];
                  if (name === 'cityMedian') return [`$${value.toLocaleString()}`, 'North Shore'];
                  return [`$${value.toLocaleString()}`, name];
                }}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as { _period?: string } | undefined;
                  return `${mode === 'monthly' ? 'Month' : 'Period'}: ${row?._period ?? label}`;
                }}
              />
              <Legend />
              {suburbs.map(s => (
                <Line
                  key={s}
                  name={s}
                  type="monotone"
                  dataKey={s}
                  stroke={suburbColors[s] || '#2563EB'}
                  strokeWidth={3}
                  connectNulls
                  dot={{ r: 6, fill: suburbColors[s] || '#2563EB' }}
                  activeDot={{ r: 8 }}
                />
              ))}
              {showDistrict && (
                <Line
                  name="North Shore"
                  type="monotone"
                  dataKey="cityMedian"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  connectNulls
                  dot={{ r: 4, fill: '#94A3B8' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
