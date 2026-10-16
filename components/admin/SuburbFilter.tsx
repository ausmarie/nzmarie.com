import React from 'react';
import { NZ_SUBURBS } from '@/lib/address-parser';
import { sortSuburbs } from '@/lib/suburb-order';

interface SuburbFilterProps {
  value: string;
  onChange: (suburb: string) => void;
  label?: string;
  showLabel?: boolean;
  className?: string;
  includeAll?: boolean;
  allLabel?: string;
  includeOther?: boolean;
  suburbs?: string[];
}

export function SuburbFilter({
  value,
  onChange,
  label = 'Filter by Suburb',
  showLabel = true,
  className = '',
  includeAll = true,
  allLabel = 'All Suburbs',
  includeOther = true,
  suburbs,
}: SuburbFilterProps) {
  const isFiltered = value && value !== 'all' && value !== '';

  const baseSuburbs = suburbs ? [...suburbs] : sortSuburbs([...NZ_SUBURBS]);
  const suburbOptions = includeOther ? [...baseSuburbs, 'Other'] : baseSuburbs;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {showLabel && (
        <label 
          htmlFor="suburb-filter" 
          className="text-sm font-medium text-gray-700"
        >
          {label}:
        </label>
      )}
      <select
        id="suburb-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {includeAll && <option value="all">{allLabel}</option>}
        {suburbOptions.map((suburb) => (
          <option key={suburb} value={suburb}>
            {suburb}
          </option>
        ))}
      </select>
      {isFiltered && (
        <button
          onClick={() => onChange('all')}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
}
