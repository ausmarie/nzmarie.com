'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const formatYAxis = (value: number) => `$${(value / 1000000).toFixed(2)}M`;

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan','02': 'Feb','03': 'Mar','04': 'Apr','05': 'May','06': 'Jun',
  '07': 'Jul','08': 'Aug','09': 'Sep','10': 'Oct','11': 'Nov','12': 'Dec',
};

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
  mode: 'monthly' | 'quarterly';
  suburbColors: Record<string, string>;
  showDistrict: boolean;
}

interface ChartRow {
  _label: string;
  cityMedian?: number;
  [key: string]: number | string | undefined;
}

function buildLabels(data: DataPoint[], suburbs: string[], mode: 'monthly' | 'quarterly'): ChartRow[] {
  if (mode === 'quarterly') {
    return data.map(d => {
      const row: ChartRow = { _label: d.period, cityMedian: d.cityMedian ?? undefined };
      for (const s of suburbs) {
        if (d.suburbs[s]?.median != null) row[s] = d.suburbs[s]!.median!;
      }
      return row;
    });
  }

  let currentYear = '';
  return data.map((d) => {
    const parts = d.period.split('-');
    const m = parts[1];
    const y = parts[0];
    const showYear = y !== currentYear;
    currentYear = y;
    const label = showYear ? `${MONTH_SHORT[m] || m} ${y}` : (MONTH_SHORT[m] || m);
    const row: ChartRow = { _label: label, cityMedian: d.cityMedian ?? undefined };
    for (const s of suburbs) {
      if (d.suburbs[s]?.median != null) row[s] = d.suburbs[s]!.median!;
    }
    return row;
  });
}

export default function MarketTrendsChart({ data, suburbs, district, mode, suburbColors, showDistrict }: Props) {
  const chartData = buildLabels(data, suburbs, mode);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-4">
        {suburbs.join(', ')}{showDistrict ? ` vs ${district}` : ''} {mode === 'monthly' ? 'Monthly' : 'Quarterly'} Median Price
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="_label" angle={-20} textAnchor="end" height={60} interval="preserveStartEnd" />
          <YAxis type="number" domain={['auto', 'auto']} tickFormatter={formatYAxis} tickCount={6} />
          <Tooltip
            formatter={(value, name) => {
              if (typeof value !== 'number') return [value, name];
              if (name === 'cityMedian') return [`$${value.toLocaleString()}`, 'North Shore'];
              return [`$${value.toLocaleString()}`, name];
            }}
            labelFormatter={(label) => `${mode === 'monthly' ? 'Month' : 'Period'}: ${label}`}
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
  );
}
