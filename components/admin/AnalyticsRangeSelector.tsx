'use client';

import React from 'react';
import { ANALYTICS_RANGE_OPTIONS, type AnalyticsRange } from '@/lib/analytics-range';

interface Props {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  ariaLabel: string;
  testIdPrefix: string;
}

export default function AnalyticsRangeSelector({ value, onChange, ariaLabel, testIdPrefix }: Props) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex bg-gray-100 rounded-lg p-0.5">
      {ANALYTICS_RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          data-testid={`${testIdPrefix}-${option.value}`}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === option.value
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
