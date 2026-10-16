'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Period = 'week' | 'month' | 'quarter' | 'year';

type SuburbRow = {
  suburb: string;
  users: number;
  new_devices: number;
  repeat_devices: number;
  last_visited_at: string | null;
};

type SectionRow = {
  section_name: string;
  total_views: number;
  unique_users: number;
  new_devices: number;
  repeat_devices: number;
};

type DailyTrendRow = {
  date: string;
  [key: string]: string | number;
};

type RecentLog = {
  time: string;
  suburb: string;
  is_new_device: boolean;
  sections: string[];
};

type SectionViewsData = {
  success: boolean;
  summary: {
    total_users: number;
    total_section_views: number;
    new_devices: number;
    repeat_devices: number;
  };
  by_suburb: SuburbRow[];
  by_section: SectionRow[];
  daily_trend: DailyTrendRow[];
  recent_logs: RecentLog[];
};

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  about: 'About',
  appraisal: 'Appraisal',
  services: 'Services',
  property_listings: 'Property Listings',
  qualifications: 'Qualifications',
  contact: 'Contact',
  report_download: 'Report Download',
};

const SECTION_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316',
];

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

export default function SuburbSectionAnalytics() {
  const [period, setPeriod] = useState<Period>('month');
  const [selectedSuburb, setSelectedSuburb] = useState<string>('all');
  const [data, setData] = useState<SectionViewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (selectedSuburb !== 'all') params.set('suburb', selectedSuburb);
      const res = await fetch(`/api/admin/analytics/section-views?${params}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [period, selectedSuburb]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allSuburbs = data?.by_suburb || [];
  const sectionData = data?.by_section || [];
  const dailyTrend = data?.daily_trend || [];
  const recentLogs = data?.recent_logs || [];

  const chartData = dailyTrend.map((row) => {
    const entry: Record<string, string | number> = { date: row.date };
    for (const key of Object.keys(row)) {
      if (key !== 'date') entry[key] = row[key] as number;
    }
    return entry;
  });

  const sectionNames = [...new Set(dailyTrend.flatMap((row) => Object.keys(row).filter((k) => k !== 'date')))];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900">Suburb Section Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">QR scan user section behavior by suburb</p>
        </div>
        <span className="text-gray-400 text-lg">{collapsed ? '\u25BC' : '\u25B2'}</span>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['week', 'month', 'quarter', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    period === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {loading && <span className="text-xs text-gray-400">Loading...</span>}
          </div>

          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: data.summary.total_users, color: 'blue' },
                { label: 'Total Section Views', value: data.summary.total_section_views, color: 'green' },
                { label: 'New Devices', value: data.summary.new_devices, color: 'emerald' },
                { label: 'Repeat Devices', value: data.summary.repeat_devices, color: 'gray' },
              ].map((card) => (
                <div key={card.label} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{card.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Suburb</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Users</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">New</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Repeat</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Last Visit</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    selectedSuburb === 'all' ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedSuburb('all')}
                >
                  <td className="py-2 px-3 font-medium text-gray-800">All Suburbs</td>
                  <td className="text-right py-2 px-3 text-gray-600">{data?.summary.total_users || 0}</td>
                  <td className="text-right py-2 px-3 text-emerald-600">{data?.summary.new_devices || 0}</td>
                  <td className="text-right py-2 px-3 text-gray-500">{data?.summary.repeat_devices || 0}</td>
                  <td className="text-right py-2 px-3 text-gray-400">-</td>
                  <td className="text-center py-2 px-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      selectedSuburb === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      View
                    </span>
                  </td>
                </tr>
                {allSuburbs.map((row) => (
                  <tr
                    key={row.suburb}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      selectedSuburb === row.suburb ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedSuburb(row.suburb)}
                  >
                    <td className="py-2 px-3 font-medium text-gray-800">{row.suburb}</td>
                    <td className="text-right py-2 px-3 text-gray-600">{row.users}</td>
                    <td className="text-right py-2 px-3 text-emerald-600">{row.new_devices}</td>
                    <td className="text-right py-2 px-3 text-gray-500">{row.repeat_devices}</td>
                    <td className="text-right py-2 px-3 text-gray-400 text-xs">
                      {row.last_visited_at ? new Date(row.last_visited_at).toLocaleDateString('en-NZ') : '-'}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        selectedSuburb === row.suburb ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        View
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sectionData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {selectedSuburb === 'all' ? 'All Suburbs' : selectedSuburb} — Section Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Section</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Views</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Unique</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">New</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700">Repeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionData.map((row) => {
                      const total = data?.summary.total_section_views || 1;
                      const pct = Math.round((row.total_views / total) * 100);
                      return (
                        <tr key={row.section_name} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-800">
                            {SECTION_LABELS[row.section_name] || row.section_name}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-600">
                            {row.total_views}
                            <span className="text-xs ml-1 text-gray-400">({pct}%)</span>
                          </td>
                          <td className="text-right py-2 px-3 text-gray-600">{row.unique_users}</td>
                          <td className="text-right py-2 px-3 text-emerald-600">{row.new_devices}</td>
                          <td className="text-right py-2 px-3 text-gray-500">{row.repeat_devices}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Section Trend (Daily)</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {sectionNames.map((name, i) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        name={SECTION_LABELS[name] || name}
                        fill={SECTION_COLORS[i % SECTION_COLORS.length]}
                        stackId="sections"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {recentLogs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Visits</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Time</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Suburb</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Device</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Sections Viewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-600 font-mono">
                          {new Date(log.time).toLocaleString('en-NZ')}
                        </td>
                        <td className="py-2 px-3 text-gray-800">{log.suburb}</td>
                        <td className="py-2 px-3">
                          {log.is_new_device ? (
                            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">New</span>
                          ) : (
                            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Repeat</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {log.sections.map((s) => SECTION_LABELS[s] || s).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
