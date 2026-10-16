'use client';

import React, { useState } from 'react';

interface SentDateFilterProps {
  dates: string[];
  onChange: (dates: string[]) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const nd = new Date(d);
  nd.setDate(nd.getDate() + diff);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

export default function SentDateFilter({ dates, onChange }: SentDateFilterProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedSet = new Set(dates);

  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(addDays(today, -1));
  const weekKeys = (() => {
    const start = startOfWeek(today);
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) keys.push(toDateKey(addDays(start, i)));
    return keys;
  })();

  const sameSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every(k => s.has(k));
  };

  const isTodayActive = sameSet(dates, [todayKey]);
  const isYesterdayActive = sameSet(dates, [yesterdayKey]);
  const isWeekActive = sameSet(dates, weekKeys);

  const toggleDate = (key: string) => {
    if (selectedSet.has(key)) {
      onChange(dates.filter(d => d !== key));
    } else {
      onChange([...dates, key].sort());
    }
  };

  const setPreset = (preset: 'today' | 'yesterday' | 'week' | 'clear') => {
    if (preset === 'today') {
      onChange([todayKey]);
    } else if (preset === 'yesterday') {
      onChange([yesterdayKey]);
    } else if (preset === 'week') {
      onChange(weekKeys);
    } else {
      onChange([]);
    }
  };

  const activeButtonStyle = (isActive: boolean, color = '#8b5cf6') => ({
    padding: '6px 14px', fontSize: '0.8rem', fontWeight: isActive ? '600' : '500', borderRadius: '8px', cursor: 'pointer',
    backgroundColor: isActive ? color : 'white',
    color: isActive ? 'white' : '#4a5568',
    border: isActive ? `2px solid ${color}` : '2px solid #e2e8f0',
    transition: 'all 0.2s ease',
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const monthDates: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) monthDates.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    monthDates.push(toDateKey(new Date(year, month, d)));
  }

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568" }}>
          Sent Date
        </label>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {dates.length > 0 ? `${dates.length} selected` : 'All dates'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setPreset('today')}
          aria-pressed={isTodayActive}
          style={activeButtonStyle(isTodayActive, '#2563eb')}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPreset('yesterday')}
          aria-pressed={isYesterdayActive}
          style={activeButtonStyle(isYesterdayActive, '#2563eb')}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => setPreset('week')}
          aria-pressed={isWeekActive}
          style={activeButtonStyle(isWeekActive, '#2563eb')}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => setCalendarOpen(open => !open)}
          aria-expanded={calendarOpen}
          aria-label="Toggle calendar"
          style={{
            padding: '6px 14px', fontSize: '0.8rem', fontWeight: '600', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: calendarOpen ? '#8b5cf6' : 'white',
            color: calendarOpen ? 'white' : '#4a5568',
            border: calendarOpen ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
            transition: 'all 0.2s ease',
          }}
        >
          Pick Dates
        </button>
        <button
          type="button"
          onClick={() => setPreset('clear')}
          disabled={dates.length === 0}
          style={{
            padding: '6px 14px', fontSize: '0.8rem', fontWeight: '500', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: 'white', color: '#dc2626', border: '2px solid #e2e8f0',
            opacity: dates.length === 0 ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          Clear
        </button>
      </div>

      {calendarOpen && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', maxWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <button type="button" onClick={prevMonth} aria-label="Previous month"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#2563eb', padding: '2px 6px' }}>
              ‹
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#334155' }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Next month"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#2563eb', padding: '2px 6px' }}>
              ›
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
            {WEEKDAYS.map(wd => <div key={wd}>{wd}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px', gap: '2px' }}>
            {monthDates.map((key, i) => {
              if (!key) return <div key={`blank-${i}`} />;
              const selected = selectedSet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDate(key)}
                  aria-pressed={selected}
                  aria-label={`Toggle ${key}`}
                  style={{
                    padding: '5px 0', fontSize: '0.72rem', borderRadius: '6px', cursor: 'pointer',
                    backgroundColor: selected ? '#2563eb' : 'white',
                    color: selected ? 'white' : '#334155',
                    border: selected ? '2px solid #2563eb' : '2px solid transparent',
                    fontWeight: selected ? '600' : '400',
                  }}
                >
                  {new Date(key + 'T00:00:00').getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
