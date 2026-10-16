'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonAnalytics } from '@/components/admin/Skeleton';
import MarketTrendsChart from '@/components/admin/MarketTrendsChart';
import ExcelUploadForm from '@/components/admin/ExcelUploadForm';
import MonthlyDataTable from '@/components/admin/MonthlyDataTable';
import ScanTrendsChart from '@/components/admin/ScanTrendsChart';
import SuburbSectionAnalytics from '@/components/admin/SuburbSectionAnalytics';
import { isSuperAdmin } from '@/lib/permissions';
import type { MonthlyDataPoint } from '@/lib/market-data-aggregator';
import { sortSuburbs, SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';
const CARD_BADGE_STYLES = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
} as const;

type LocationRow = {
  region: string;
  city: string;
  count: number;
};

type RegionRow = {
  region: string;
  count: number;
};

const FALLBACK_SUBURBS = [...SUBURB_PRIORITY_ORDER];

/**
 * Full chip list for REINZ Market Trends / Analysis Data: always shows every
 * suburb in SUBURB_PRIORITY_ORDER (same order as the properties page Quick
 * Filter by Suburb), then appends any data-only suburbs alphabetically.
 */
function buildSuburbChipList(available: string[]): string[] {
  const known = SUBURB_PRIORITY_ORDER as readonly string[];
  const extras = sortSuburbs(available.filter(s => !known.includes(s)));
  return [...known, ...extras];
}

type DataMode = 'monthly' | 'quarterly';

type ScanLogEntry = {
  id: string;
  campaign_key: string;
  visitor_hash: string;
  ip_address: string;
  user_agent: string;
  device_type: string;
  referrer: string;
  is_unique: boolean;
  is_new_device: boolean;
  visit_count?: number;
  created_at: string;
};

type ScanLogsPage = {
  logs?: ScanLogEntry[];
};

const SUBURB_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getSuburbColor(index: number): string {
  return SUBURB_COLORS[index % SUBURB_COLORS.length];
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState({
    totalCost: 0, totalRevenue: 0, totalMailed: 0, totalDownloads: 0,
    totalAppraisals: 0, totalConversions: 0,
  });

  const [locationStats, setLocationStats] = useState<LocationRow[]>([]);
  const [regionStats, setRegionStats] = useState<RegionRow[]>([]);
  const [locationTotal, setLocationTotal] = useState(0);

  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');

  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Oteha']);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<MonthlyDataPoint[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>('monthly');
  const [chartLoading, setChartLoading] = useState(false);
  const [chartNeedsMigration, setChartNeedsMigration] = useState(false);
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>(FALLBACK_SUBURBS);
  const [showDistrict, setShowDistrict] = useState(true);
  const [activeFocusSuburb, setActiveFocusSuburb] = useState<string>('Oteha');
  const [tableDataMode, setTableDataMode] = useState<DataMode>('monthly');

  const [lastSoldData, setLastSoldData] = useState<{
    suburbs: Array<{
      suburb: string;
      total: number;
      buckets: Array<{ range: string; count: number; percentage: number }>;
    }>;
    northShore: {
      total: number;
      buckets: Array<{ range: string; count: number; percentage: number }>;
    };
  } | null>(null);
  const [lastSoldFilterType, setLastSoldFilterType] = useState<'all' | 'house' | 'townhouse'>('all');

  const [scanData, setScanData] = useState<{
    total_scans: number;
    total_unique: number;
    total_new_devices?: number;
    campaigns: Array<{ campaign_key: string; campaign_name: string; total_pv: number; total_uv: number; new_devices?: number; last_visited_at: string | null }>;
    logs: Array<{ id: string; campaign_key: string; visitor_hash: string; ip_address: string; user_agent: string; device_type: string; referrer: string; is_unique: boolean; is_new_device: boolean; visit_count?: number; created_at: string }>;
  }>({ total_scans: 0, total_unique: 0, total_new_devices: 0, campaigns: [], logs: [] });

  const [showScanLogsModal, setShowScanLogsModal] = useState(false);
  const [selectedScanCampaign, setSelectedScanCampaign] = useState<string>('all');
  const [scanLogTypeFilter, setScanLogTypeFilter] = useState<string>('all');
  const [scanLogDateFilter, setScanLogDateFilter] = useState<string>('');

  const fetchScanData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/scans');
      const data = await res.json();
      if (data.success) {
        const sortedCampaigns = (data.campaigns || []).slice().sort((
          a: { new_devices?: number; total_pv: number; campaign_name?: string; campaign_key?: string },
          b: { new_devices?: number; total_pv: number; campaign_name?: string; campaign_key?: string }
        ) => {
          const ndA = a.new_devices ?? 0;
          const ndB = b.new_devices ?? 0;
          if (ndB !== ndA) return ndB - ndA;
          if (b.total_pv !== a.total_pv) return b.total_pv - a.total_pv;
          return (a.campaign_name || a.campaign_key || '').localeCompare(b.campaign_name || b.campaign_key || '');
        });
        setScanData({ ...data, campaigns: sortedCampaigns });
      }
    } catch {
    }
  }, []);

  const limit = 20;
  const scanLogsQuery = useInfiniteQuery({
    queryKey: ['scanLogs', selectedScanCampaign, scanLogTypeFilter, scanLogDateFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(limit) });
      if (selectedScanCampaign && selectedScanCampaign !== 'all') params.set('campaign', selectedScanCampaign);
      if (scanLogTypeFilter && scanLogTypeFilter !== 'all') params.set('type', scanLogTypeFilter);
      if (scanLogDateFilter) params.set('date', scanLogDateFilter);
      const res = await fetch(`/api/admin/analytics/scans?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load scan logs');
      return json;
    },
    initialPageParam: 1,
    enabled: showScanLogsModal,
    getNextPageParam: (lastPage) => {
      const page = lastPage.page ?? 1;
      const limitVal = lastPage.limit ?? limit;
      const total = lastPage.total_logs ?? 0;
      const fetchedSoFar = page * limitVal;
      return fetchedSoFar < total ? page + 1 : undefined;
    },
  });

  const scanLogs = scanLogsQuery.data ? scanLogsQuery.data.pages.flatMap((p: ScanLogsPage) => p.logs || []) : [];
  const scanTotalLogs = scanLogsQuery.data?.pages?.[0]?.total_logs ?? scanData.total_scans ?? 0;

  const scanSentinelRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scanLogsQuery.hasNextPage || !scanSentinelRef.current) return;
    const el = scanSentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && scanLogsQuery.hasNextPage && !scanLogsQuery.isFetchingNextPage) {
          scanLogsQuery.fetchNextPage();
        }
      });
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanLogsQuery.hasNextPage, scanLogsQuery.isFetchingNextPage, scanLogsQuery.fetchNextPage]);

  const chartReqIdRef = React.useRef(0);

  const fetchAvailableSuburbs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/available-suburbs');
      const data = await res.json();
      if (data.availableSuburbs && Array.isArray(data.availableSuburbs) && data.availableSuburbs.length > 0) {
        const sorted = buildSuburbChipList(data.availableSuburbs);
        setAvailableSuburbs(sorted);
        setSelectedSuburbs(prev => {
          if (prev.length === 0) return prev;
          const filtered = prev.filter(s => sorted.includes(s));
          const next = filtered.length > 0 ? filtered : [sorted[0]];
          if (next.length === prev.length && next.every((s, i) => s === prev[i])) {
            return prev;
          }
          return next;
        });
      }
    } catch {
      // fallback stays
    }
  }, []);

  useEffect(() => {
    if (availableSuburbs.length > 0) {
      setActiveFocusSuburb(prev =>
        prev !== 'North Shore City' && !availableSuburbs.includes(prev) ? availableSuburbs[0] : prev
      );
    }
  }, [availableSuburbs]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !isSuperAdmin(session.user.email)) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  const fetchLastSoldData = useCallback(async (type: 'all' | 'house' | 'townhouse') => {
    try {
      const params = new URLSearchParams({ type });
      const res = await fetch(`/api/admin/analytics/last-sold-data?${params}`);
      const data = await res.json();
      if (data.success) {
        setLastSoldData(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchAvailableSuburbs();
      fetch('/api/admin/analytics/overview')
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setStats({
              totalCost: data.total_cost ?? 0,
              totalRevenue: data.total_revenue ?? 0,
              totalMailed: data.total_mailed ?? 0,
              totalDownloads: data.total_downloads ?? 0,
              totalAppraisals: data.total_appraisals ?? 0,
              totalConversions: data.total_conversions ?? 0,
            });
          }
        })
        .catch(() => undefined);

      fetch('/api/admin/analytics/location')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.locations) {
            setLocationStats(data.locations);
            setRegionStats(data.regions ?? []);
            setLocationTotal(data.total ?? 0);
          }
        })
        .catch(() => undefined);

      fetchLastSoldData(lastSoldFilterType);
      fetchScanData();
    }
  }, [status, session?.user?.email, fetchAvailableSuburbs, fetchLastSoldData, fetchScanData, lastSoldFilterType]);

  const fetchChartData = useCallback(async (suburbs: string[]) => {
    const reqId = ++chartReqIdRef.current;
    setChartLoading(true);
    setChartNeedsMigration(false);
    try {
      const res = await fetch(`/api/admin/analytics/chart-data?suburbs=${suburbs.map(encodeURIComponent).join(',')}&district=North Shore City`);
      const data = await res.json();
      if (reqId !== chartReqIdRef.current) return;
      if (data.needsMigration) {
        setChartNeedsMigration(true);
      } else if (data.success) {
        setMonthlyData(data.data.monthlyData ?? []);
        setQuarterlyData(data.data.quarterlyData ?? []);
      }
    } catch {
    } finally {
      if (reqId === chartReqIdRef.current) {
        setChartLoading(false);
      }
    }
  }, []);

  const selectedSuburbsKey = selectedSuburbs.join(',');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && isSuperAdmin(session.user.email)) {
      fetchChartData(selectedSuburbsKey.split(',').filter(Boolean));
    }
  }, [status, session?.user?.email, selectedSuburbsKey, fetchChartData]);

  const toggleSuburb = (s: string) => {
    setSelectedSuburbs(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
    setActiveFocusSuburb(s);
  };

  useEffect(() => {
    setActiveFocusSuburb(prev => {
      if (selectedSuburbs.length > 0 && !selectedSuburbs.includes(prev)) {
        return selectedSuburbs[0];
      }
      if (selectedSuburbs.length === 0) {
        return 'North Shore City';
      }
      return prev;
    });
  }, [selectedSuburbs]);

  const runMigration = async () => {
    setMigrationStatus('running');
    setMigrationMessage('');
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMigrationStatus('success');
        const msgs = (data.results as { migration: string; status: string; message: string }[])
          .map(r => `${r.migration}: ${r.message}`)
          .join('\n');
        setMigrationMessage(msgs || 'Migration completed successfully');
      } else {
        setMigrationStatus('error');
        setMigrationMessage(data.error || 'Unknown error');
      }
    } catch {
      setMigrationStatus('error');
      setMigrationMessage('Network failure');
    }
  };

  if (status === 'loading') {
    return <SkeletonAnalytics />;
  }

  if (!session || (session.user?.email && !isSuperAdmin(session.user.email))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This page is only available to super administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">
          Campaign performance, ROI tracking, and conversion funnels
        </p>
      </div>

      {/* DB Migration Panel — super admin only */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-800">🛠 Database Migrations</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Run pending migrations to add new columns (e.g., region &amp; city to appraisal_leads).
            </p>
            {migrationMessage && (
              <pre className="text-xs text-amber-900 mt-1 whitespace-pre-wrap">{migrationMessage}</pre>
            )}
          </div>
          <button
            onClick={runMigration}
            disabled={migrationStatus === 'running'}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              migrationStatus === 'success'
                ? 'bg-green-600 text-white cursor-default'
                : migrationStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60'
            }`}
          >
            {migrationStatus === 'running' ? '⏳ Running...'
              : migrationStatus === 'success' ? '✅ Done'
              : migrationStatus === 'error' ? '❌ Retry'
              : 'Run Migrations'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">📱</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                QR Scans
              </span>
            </div>
            <button
              onClick={() => setShowScanLogsModal(true)}
              className="text-left w-full hover:opacity-80 transition-opacity"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-gray-900">
                  {scanData.total_scans}
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {scanData.total_new_devices ?? 0} New Devices
                </span>
              </div>
              <div className="text-sm text-gray-600">Total Scans</div>
            </button>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scanData.campaigns.length > 0 ? (
                scanData.campaigns.map((c) => (
                  <span
                    key={c.campaign_key}
                    className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium border border-blue-100"
                  >
                    {c.campaign_name || c.campaign_key}: {c.new_devices ?? 0}/{c.total_pv}
                  </span>
                ))
              ) : (
                <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                  No scans yet
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setScanLogDateFilter('');
                setSelectedScanCampaign('all');
                setShowScanLogsModal(true);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Log Details &rarr;
            </button>
          </div>
        </div>

        {[
          { label: 'Total Campaigns', value: stats.totalMailed.toString(), icon: '📬', color: 'blue' as const },
          { label: 'Download Rate', value: `${stats.totalMailed > 0 ? ((stats.totalDownloads / stats.totalMailed) * 100).toFixed(0) : 0}%`, icon: '📥', color: 'green' as const },
          { label: 'Conversion Rate', value: `${stats.totalAppraisals > 0 ? ((stats.totalConversions / stats.totalAppraisals) * 100).toFixed(0) : 0}%`, icon: '✅', color: 'purple' as const },
          { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString('en-NZ')}`, icon: '💰', color: 'yellow' as const },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${CARD_BADGE_STYLES[stat.color]}`}>
                This Month
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

       <ScanTrendsChart
        onDrillDown={(date, campaignKey) => {
          setScanLogDateFilter(date);
          setSelectedScanCampaign(campaignKey || 'all');
          setShowScanLogsModal(true);
        }}
      />

      {/* Market Data Table */}
      <MonthlyDataTable
        monthlyData={monthlyData}
        dataMode={tableDataMode}
        onModeChange={setTableDataMode}
        activeFocusSuburb={activeFocusSuburb}
        availableSuburbs={availableSuburbs}
        onFocusChange={(suburb) => {
          setActiveFocusSuburb(suburb);
          if (suburb !== 'North Shore City') {
            setSelectedSuburbs([suburb]);
          } else {
            setSelectedSuburbs([]);
          }
        }}
      />

      {/* Market Trends Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">REINZ Market Trends</h2>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setDataMode('monthly')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dataMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Monthly</button>
            <button
              onClick={() => setDataMode('quarterly')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dataMode === 'quarterly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >Quarterly</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableSuburbs.map((s, i) => {
            const active = selectedSuburbs.includes(s);
            const color = getSuburbColor(i);
            return (
              <button
                key={s}
                onClick={() => toggleSuburb(s)}
                className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
                  active
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 border-gray-300 hover:border-gray-400 bg-white'
                }`}
                style={active ? { backgroundColor: color, borderColor: color } : undefined}
              >
                {s}
              </button>
            );
          })}
          <button
            onClick={() => setShowDistrict(v => !v)}
            className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
              showDistrict
                ? 'bg-[#94A3B8] text-white border-[#94A3B8] shadow-sm'
                : 'text-gray-500 border-gray-300 hover:border-gray-400 bg-white'
            }`}
          >
            North Shore {showDistrict ? '✓' : ''}
          </button>
        </div>
        {(() => {
          const activeData = dataMode === 'monthly' ? monthlyData : quarterlyData;
          if (chartNeedsMigration) {
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center justify-center h-[200px]">
                <div className="text-center">
                  <p className="text-lg font-semibold text-amber-800 mb-2">Table Not Found</p>
                  <p className="text-sm text-amber-700">The market data table has not been created yet.</p>
                  <p className="text-sm text-amber-700">Click <strong>&ldquo;Run Migrations&rdquo;</strong> at the top of this page, then upload a REINZ Excel file.</p>
                </div>
              </div>
            );
          }
          if (chartLoading && activeData.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[400px]">
                <div className="text-gray-400">Loading chart data...</div>
              </div>
            );
          }
          if (activeData.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[200px]">
                <div className="text-center text-gray-400">
                  <p className="text-lg mb-2">No market data yet</p>
                  <p className="text-sm">Upload a REINZ Excel file below to get started</p>
                </div>
              </div>
            );
          }
          return (
            <div className="relative">
              <MarketTrendsChart
                data={activeData}
                suburbs={selectedSuburbs}
                district="North Shore City"
                mode={dataMode}
                suburbColors={Object.fromEntries(selectedSuburbs.map(s => [s, getSuburbColor(availableSuburbs.indexOf(s))]))}
                showDistrict={showDistrict}
              />
              {chartLoading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-10">
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Last Sold Data For Sale */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Last Sold Data For Sale</h2>
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
            {(['all', 'house', 'townhouse'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setLastSoldFilterType(type)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  lastSoldFilterType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? 'All' : type === 'house' ? 'House' : 'Townhouse/Unit'}
              </button>
            ))}
          </div>
        </div>
        {!lastSoldData ? (
          <div className="text-gray-400 py-4">Loading...</div>
        ) : !lastSoldData.suburbs || lastSoldData.suburbs.length === 0 ? (
          <div className="text-gray-400 py-4">No data available for the selected filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Suburb</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Active</th>
                  {lastSoldData.northShore.buckets.filter(b => b.range !== 'no_data').map(b => (
                    <th key={b.range} className="text-right py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">
                      {b.range} yrs
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">No Data</th>
                </tr>
              </thead>
              <tbody>
                {lastSoldData.suburbs.map((row) => {
                  const displayBuckets = row.buckets.filter(b => b.range !== 'no_data');
                  const recentBuckets = displayBuckets.filter(b => b.range === '0-3' || b.range === '3-5');
                  const lifecycleBuckets = displayBuckets.filter(b => b.range === '5-10' || b.range === '10-15' || b.range === '15+');
                  const recentMax = recentBuckets.length > 0 ? Math.max(...recentBuckets.map(b => b.percentage)) : -1;
                  const lifecycleMax = lifecycleBuckets.length > 0 ? Math.max(...lifecycleBuckets.map(b => b.percentage)) : -1;
                  return (
                    <tr
                      key={row.suburb}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-3 font-medium text-gray-800">{row.suburb}</td>
                      <td className="text-right py-2 px-3 text-gray-600">{row.total}</td>
                      {displayBuckets.map(b => {
                        const isRecent = b.range === '0-3' || b.range === '3-5';
                        const isLifecycle = b.range === '5-10' || b.range === '10-15' || b.range === '15+';
                        const isRecentMax = isRecent && b.percentage > 10 && b.percentage === recentMax;
                        const isLifecycleMax = isLifecycle && b.percentage > 10 && b.percentage === lifecycleMax;
                        let cellClass = 'text-right py-2 px-3 text-gray-600';
                        if (isRecentMax) {
                          cellClass = 'text-right py-2 px-3 bg-blue-50 text-blue-700 font-semibold border border-blue-100 rounded';
                        } else if (isLifecycleMax) {
                          cellClass = 'text-right py-2 px-3 bg-green-50 text-green-700 font-semibold border border-green-100 rounded';
                        }
                        return (
                          <td key={b.range} className={cellClass}>
                            {b.count}
                            <span className="text-xs ml-1">({b.percentage}%)</span>
                          </td>
                        );
                      })}
                      <td className="text-right py-2 px-3 text-gray-400">
                        {row.buckets.find(b => b.range === 'no_data')?.count || 0}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-2 px-3 text-gray-800">North Shore Total</td>
                  <td className="text-right py-2 px-3 text-gray-800">{lastSoldData.northShore.total}</td>
                  {lastSoldData.northShore.buckets.filter(b => b.range !== 'no_data').map(b => (
                    <td key={b.range} className="text-right py-2 px-3 text-gray-800">
                      {b.count}
                      <span className="text-xs ml-1">({b.percentage}%)</span>
                    </td>
                  ))}
                  <td className="text-right py-2 px-3 text-gray-400">
                    {lastSoldData.northShore.buckets.find(b => b.range === 'no_data')?.count || 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SuburbSectionAnalytics />

             {/* Excel Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExcelUploadForm onSuccess={(suburb) => {
          if (suburb && !selectedSuburbs.includes(suburb)) {
            setSelectedSuburbs(prev => [...prev, suburb]);
          } else if (suburb) {
            fetchChartData(selectedSuburbs);
          }
          fetchAvailableSuburbs();
        }} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Guide</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>1. Export REINZ data for a suburb (e.g., Torbay)</p>
            <p>2. Upload the .xlsx or .csv file using the form</p>
            <p>3. Table is auto-created if needed, data is imported</p>
            <p>4. Chart refreshes automatically with the uploaded data</p>
            <p>5. Click suburb buttons to compare multiple suburbs</p>
          </div>
        </div>
      </div>

      {locationStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Geographic Distribution</h3>
          <p className="text-sm text-gray-500 mb-4">Appraisal requests grouped by region and city with share of total leads</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {regionStats.map((region) => {
              const percent = locationTotal > 0 ? Math.round((region.count / locationTotal) * 100) : 0;
              return (
                <div key={region.region} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Region</div>
                      <div className="text-sm font-semibold text-slate-900">{region.region}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{region.count}</div>
                      <div className="text-xs text-slate-400">{percent}%</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStats.slice(0, 9).map((loc) => {
              const percent = locationTotal > 0 ? Math.round((loc.count / locationTotal) * 100) : 0;
              return (
                <div key={`${loc.region}-${loc.city}`} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800">{loc.region}</div>
                      <div className="text-xs text-slate-500">{loc.city}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{loc.count}</div>
                      <div className="text-xs text-slate-400">{percent}%</div>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Mail sent</span><span>{stats.totalMailed}</span></div>
            <div className="flex justify-between text-sm"><span>Downloads</span><span>{stats.totalDownloads}</span></div>
            <div className="flex justify-between text-sm"><span>Appraisals</span><span>{stats.totalAppraisals}</span></div>
            <div className="flex justify-between text-sm"><span>Conversions</span><span>{stats.totalConversions}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ROI Snapshot</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span>Revenue</span><span>${stats.totalRevenue.toLocaleString('en-NZ')}</span></div>
            <div className="flex justify-between text-sm"><span>Cost</span><span>${stats.totalCost.toLocaleString('en-NZ')}</span></div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Net</span>
              <span>${(stats.totalRevenue - stats.totalCost).toLocaleString('en-NZ')}</span>
            </div>
          </div>
        </div>
      </div>

      {showScanLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">QR Code Scan Logs</h2>
                <p className="text-sm text-gray-500">Detailed record of direct mail visitor scans</p>
              </div>
              <button
                onClick={() => setShowScanLogsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

              <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedScanCampaign('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedScanCampaign === 'all'
                    ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                All Campaigns ({scanTotalLogs})
              </button>
              {scanData.campaigns.map((c) => (
                <button
                  key={c.campaign_key}
                  onClick={() => setSelectedScanCampaign(c.campaign_key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedScanCampaign === c.campaign_key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {c.campaign_name || c.campaign_key} ({c.total_pv})
                </button>
              ))}
              {scanLogDateFilter && (
                <span className="inline-flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  Filtering: {new Date(scanLogDateFilter).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  <button
                    onClick={() => setScanLogDateFilter('')}
                    className="text-amber-500 hover:text-amber-700 ml-1 font-bold"
                  >
                    ✕
                  </button>
                </span>
              )}
              </div>

              <div className="p-4 border-b border-gray-100 bg-white flex flex-wrap items-center gap-2">
                {[
                  { key: 'all', label: 'All Types', count: scanTotalLogs },
                  { key: 'new_device', label: 'New Device', count: scanLogsQuery.data?.pages?.[0]?.new_device_count ?? 0 },
                  { key: 'repeat', label: 'Repeat', count: scanLogsQuery.data?.pages?.[0]?.repeat_count ?? 0 },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setScanLogTypeFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      scanLogTypeFilter === t.key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

            <div className="flex-1 overflow-y-auto p-6">
              {scanLogs.length === 0 && !scanLogsQuery.isFetching ? (
                <div className="text-center py-12 text-gray-500">No scan logs recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Campaign</th>
                        <th className="py-3 px-4">Visitor Fingerprint</th>
                        <th className="py-3 px-4">Device &amp; IP</th>
                        <th className="py-3 px-4">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {scanLogs.map((log: ScanLogEntry) => (
                        <tr key={log.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-mono text-xs text-gray-600 select-text">{new Date(log.created_at).toLocaleString('en-NZ')}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-900 text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {log.campaign_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-gray-500 select-text">{log.visitor_hash ? `${log.visitor_hash.substring(0, 12)}...` : 'N/A'}</td>
                          <td className="py-3 px-4 text-xs text-gray-600">
                            <div>{log.ip_address || 'Unknown IP'}</div>
                            <div className="text-gray-400 truncate max-w-[200px] select-text" title={log.user_agent}>{log.device_type ? `${log.device_type} · ` : ''}{log.user_agent || 'Unknown UA'}</div>
                          </td>
                          <td className="py-3 px-4">
                            {log.is_new_device ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300">New Device</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Repeat{log.visit_count ? ` ×${log.visit_count}` : ''}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {scanLogsQuery.hasNextPage && (
                <div ref={scanSentinelRef} />
              )}
              {scanLogsQuery.isFetchingNextPage && (
                <div className="pt-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
