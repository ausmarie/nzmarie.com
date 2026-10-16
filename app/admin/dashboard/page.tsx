"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SkeletonDashboard } from "@/components/admin/Skeleton";
import { SuburbFilter } from "@/components/admin/SuburbFilter";
import DispatchTrendSection, { DispatchTrend } from "@/components/admin/DispatchTrendSection";
import ScanTrendsChart from "@/components/admin/ScanTrendsChart";
import CampaignScanLogsPanel from "@/components/admin/CampaignScanLogsPanel";
import { SUBURB_PRIORITY_ORDER } from "@/lib/suburb-order";

interface SentSummaryItem {
  suburb: string;
  sent_count: number;
}

interface QuarterlySentSuburb {
  suburb: string;
  sent_count: number;
  last_sent_at: string | null;
  report_url: string | null;
}

interface QuarterlySentSummary {
  quarter_key: string;
  total_sent: number;
  suburbs: QuarterlySentSuburb[];
}

interface SentSummary {
  total_sent: number;
  suburb_count: number;
  suburbs: SentSummaryItem[];
  quarterly: QuarterlySentSummary[];
}

interface ScanCampaign {
  campaign_key: string;
  campaign_name: string;
  total_pv: number;
  total_uv: number;
  new_devices?: number;
}

interface ScanStats {
  total_scans: number;
  total_unique: number;
  total_new_devices?: number;
  campaigns: ScanCampaign[];
}

interface SuburbDownload {
  suburb: string;
  download_count: number;
}

interface DashboardStats {
  newLeads: number;
  highPriorityLeads: number;
  pendingOutreach: number;
  sentOutreach: number;
  todayFollowups: number;
  overdueFollowups: number;
  todayDownloads: number;
  totalDownloads: number;
  monthDownloads: number;
  totalBookings: number;
  monthBookings: number;
  qrCodesTotal: number;
  pdfReportsTotal: number;
  outreachBySuburb: OutreachSuburb[];
  sentSummary: SentSummary;
  scanStats: ScanStats;
  downloadsBySuburb: SuburbDownload[];
  recentDownloads: RecentDownload[];
  dispatchTrend: DispatchTrend;
}

interface OutreachSuburb {
  suburb: string;
  pending_count: number;
  sent_count: number;
  total_count: number;
  last_sent_at: string | null;
}

interface RecentDownload {
  id: string;
  email: string;
  name: string;
  suburb: string;
  downloaded_at: string;
  source: string;
  tracking_code: string | null;
}

interface FollowUp {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_address: string;
  suburb: string;
  priority: string;
  contact_status: string;
  follow_up_at: string;
  last_contact_at: string;
  agent_notes: string;
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "high": return "bg-red-100 text-red-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    case "low": return "bg-green-100 text-green-700";
    default: return "bg-slate-100 text-slate-600";
  }
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suburbFilter, setSuburbFilter] = useState<string>('all');
  const [scanLogDateFilter, setScanLogDateFilter] = useState('');
  const [scanLogCampaign, setScanLogCampaign] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const statsParams = new URLSearchParams();
      if (suburbFilter && suburbFilter !== 'all') {
        statsParams.set('suburb', suburbFilter);
      }

      const bookingsParams = new URLSearchParams({ page: '1', limit: '10' });
      if (suburbFilter && suburbFilter !== 'all') {
        bookingsParams.set('suburb', suburbFilter);
      }

      const statsUrl = `/api/admin/dashboard/stats${statsParams.toString() ? `?${statsParams}` : ''}`;
      const [statsRes, followupsRes] = await Promise.all([
        fetch(statsUrl),
        fetch(`/api/admin/bookings?${bookingsParams}`),
      ]);

      if (!statsRes.ok || !followupsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsRes.json();
      const followupsData = await followupsRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }

      if (followupsData.data) {
        const todayFollowups = followupsData.data.filter((lead: FollowUp) => {
          if (!lead.follow_up_at) return false;
          const followUpDate = new Date(lead.follow_up_at).toDateString();
          const today = new Date().toDateString();
          return (
            followUpDate === today &&
            !["converted", "lost"].includes(lead.contact_status)
          );
        });
        setFollowUps(todayFollowups);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
      setLoading(false);
    }
  }, [suburbFilter]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, fetchDashboardData]);

  if (status === "loading" || loading) {
    return <SkeletonDashboard />;
  }

  const userName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  // Outreach by Suburb: most recently sent suburb first (defensive sort so the
  // display order is guaranteed even if the API order changes).
  const outreachBySuburb = [...(stats?.outreachBySuburb ?? [])].sort((a, b) => {
    const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
    const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : Number.NEGATIVE_INFINITY;
    return tb - ta;
  });

  const sentSummarySuburbs = [...(stats?.sentSummary?.suburbs ?? [])].sort((a, b) => b.sent_count - a.sent_count);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {userName}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-4">
        <SuburbFilter
          value={suburbFilter}
          onChange={setSuburbFilter}
          label="Filter by Suburb"
          showLabel={true}
          suburbs={[...SUBURB_PRIORITY_ORDER]}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/activity"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          View Appraisals
        </Link>
        <Link
          href="/admin/outreach"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Manage Outreach
        </Link>
        <Link
          href="/admin/assets"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Manage Assets
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex flex-col justify-between min-h-[192px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">📬</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                Sent
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {stats?.sentSummary?.total_sent ?? 0}
            </div>
            <div className="text-sm text-slate-600">Total Sent</div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
            {stats?.sentSummary?.quarterly && stats.sentSummary.quarterly.length > 0 ? (
              stats.sentSummary.quarterly.map((q) => (
                <div key={q.quarter_key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{q.quarter_key}</span>
                    <span className="text-xs text-slate-500">{q.total_sent} sent</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {q.suburbs.map((s) => (
                      <span
                        key={s.suburb}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium border border-blue-100"
                      >
                        {s.suburb}: {s.sent_count}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats?.sentSummary?.suburbs && sentSummarySuburbs.length > 0 ? (
                  sentSummarySuburbs.map((item) => (
                    <span
                      key={item.suburb}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium border border-blue-100"
                    >
                      {item.suburb}: {item.sent_count}
                    </span>
                  ))
                ) : (
                  <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                    No suburb with sent &gt; 1
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex flex-col justify-between min-h-[192px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">👁</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                QR Scans
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-slate-900">
                {stats?.scanStats?.total_scans ?? 0}
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {stats?.scanStats?.total_new_devices ?? 0} New Devices
              </span>
            </div>
            <div className="text-sm text-slate-600">Total Scans</div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5">
              {stats?.scanStats?.campaigns && stats.scanStats.campaigns.length > 0 ? (
                stats.scanStats.campaigns.map((c) => (
                  <span
                    key={c.campaign_key}
                    className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium border border-indigo-100"
                  >
                    {c.campaign_name || c.campaign_key}: {c.new_devices ?? 0}/{c.total_pv}
                  </span>
                ))
              ) : (
                <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                  No scans yet
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex flex-col justify-between min-h-[192px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">📥</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                Downloads
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {stats?.totalDownloads ?? 0}
            </div>
            <div className="text-sm text-slate-600">Total Downloads</div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5">
              {stats?.downloadsBySuburb && stats.downloadsBySuburb.length > 0 ? (
                stats.downloadsBySuburb.map((item) => (
                  <span
                    key={item.suburb}
                    className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-medium border border-green-100"
                  >
                    {item.suburb}: {item.download_count}
                  </span>
                ))
              ) : (
                <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                  No downloads yet
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">New Leads</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {stats?.newLeads ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">This month</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">High Priority</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {stats?.highPriorityLeads ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Urgent</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Follow-ups</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {stats?.todayFollowups ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Today</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Overdue</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {stats?.overdueFollowups ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Follow-ups</p>
        </div>
      </div>

      {stats?.dispatchTrend && <DispatchTrendSection trend={stats.dispatchTrend} />}

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Scan Trends</h2>
        </div>
        <div className="p-6">
          <ScanTrendsChart
            onDrillDown={(date, campaignKey) => {
              setScanLogDateFilter(date);
              setScanLogCampaign(campaignKey || '');
              const el = document.getElementById('dashboard-scan-logs');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </div>

      <div id="dashboard-scan-logs">
        <CampaignScanLogsPanel
          initialCampaign={scanLogCampaign}
          initialDateFilter={scanLogDateFilter}
        />
      </div>

      {outreachBySuburb.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Outreach by Suburb
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {outreachBySuburb.map((item) => (
                <div key={item.suburb} className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-800 mb-3">{item.suburb}</div>
                  <div className="flex gap-3 text-sm">
                    <div className="flex-1 bg-blue-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-blue-700">{item.pending_count}</div>
                      <div className="text-xs text-blue-600">Pending</div>
                    </div>
                    <div className="flex-1 bg-emerald-50 rounded p-2 text-center">
                      <div className="text-lg font-bold text-emerald-700">{item.sent_count}</div>
                      <div className="text-xs text-emerald-600">Sent</div>
                    </div>
                    <div className="flex-1 bg-slate-100 rounded p-2 text-center">
                      <div className="text-lg font-bold text-slate-700">{item.total_count}</div>
                      <div className="text-xs text-slate-600">Total</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Today&apos;s Follow-ups
              </h2>
              <Link
                href="/admin/activity"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            </div>
            {followUps.length > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                {followUps.length} leads need attention
              </p>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {followUps.length > 0 ? (
              followUps.map((followUp) => (
                <div key={followUp.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(followUp.priority)}`}>
                          {followUp.priority.charAt(0).toUpperCase() + followUp.priority.slice(1)}
                        </span>
                        <h3 className="font-medium text-slate-900">
                          {followUp.name}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {followUp.property_address}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {followUp.suburb}
                        {followUp.last_contact_at &&
                          ` • Last contact: ${new Date(followUp.last_contact_at).toLocaleDateString("en-NZ")}`}
                      </p>
                      {followUp.agent_notes && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          {followUp.agent_notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <a
                        href={`tel:${followUp.phone}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </a>
                      <a
                        href={`mailto:${followUp.email}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors ml-2"
                        title="Email"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-500">No follow-ups scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Quick Stats</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-slate-700">Bookings</span>
                <span className="text-xl font-bold text-blue-600">
                  {stats?.totalBookings ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                <span className="text-sm text-slate-700">Bookings (Month)</span>
                <span className="text-xl font-bold text-indigo-600">
                  {stats?.monthBookings ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <span className="text-sm text-slate-700">Downloads (Month)</span>
                <span className="text-xl font-bold text-emerald-600">
                  {stats?.monthDownloads ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <span className="text-sm text-slate-700">Outreach Sent</span>
                <span className="text-xl font-bold text-amber-600">
                  {stats?.sentOutreach ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Assets</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm text-slate-700">QR Codes</span>
                <span className="text-xl font-bold text-purple-600">
                  {stats?.qrCodesTotal ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                <span className="text-sm text-slate-700">PDF Reports</span>
                <span className="text-xl font-bold text-rose-600">
                  {stats?.pdfReportsTotal ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {stats?.recentDownloads && stats.recentDownloads.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Downloads
            </h2>
            <Link
              href="/admin/activity"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Suburb</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDownloads.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.suburb}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(item.downloaded_at).toLocaleDateString('en-NZ', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.source === 'direct_mail' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {item.source === 'direct_mail' ? 'Direct Mail' : 'Organic'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
