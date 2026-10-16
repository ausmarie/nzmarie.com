'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonDownloads } from '@/components/admin/Skeleton';
import { SuburbFilter } from '@/components/admin/SuburbFilter';
import { isSuperAdmin } from '@/lib/permissions';

interface Download {
  id: string;
  email: string;
  name: string;
  suburb: string;
  report_type: string;
  downloaded_at: string;
  source: string;
  tracking_code: string | null;
  created_at: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total_downloads: string;
  this_month: string;
  unique_users: string;
}

const isAdminUser = (email?: string | null) => 
  email ? isSuperAdmin(email) : false;

export default function DownloadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === 'authenticated' && !isAdminUser(session?.user?.email)) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDownloads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(suburbFilter !== 'all' && { suburb: suburbFilter }),
        ...(sourceFilter !== 'all' && { source: sourceFilter }),
      });

      const res = await fetch(`/api/admin/downloads?${params}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      setDownloads(data.data || []);
      setPagination(data.pagination || null);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, suburbFilter, sourceFilter]);

  useEffect(() => {
    if (status === 'authenticated' && isAdminUser(session?.user?.email)) {
      fetchDownloads();
    }
  }, [status, session, fetchDownloads]);

  const clearFilters = () => {
    setSearch('');
    setSuburbFilter('all');
    setSourceFilter('all');
    setPage(1);
  };

  if (status === 'loading') {
    return <SkeletonDownloads />;
  }

  if (!session || !isAdminUser(session.user?.email)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📥 Downloads</h1>
          <p className="text-gray-600 mt-1">Track PDF downloads and monitor user engagement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Downloads', value: stats?.total_downloads || '0', subtitle: 'All time' },
          { label: 'This Month', value: stats?.this_month || '0', subtitle: 'Current period' },
          { label: 'Unique Users', value: stats?.unique_users || '0', subtitle: 'Total users' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-gray-900">{stat.label}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            id="downloads-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or tracking code..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center">
            <SuburbFilter
              value={suburbFilter}
              onChange={(value) => { setSuburbFilter(value); setPage(1); }}
              showLabel={false}
              allLabel="All Suburbs"
            />
          </div>
          <select
            id="downloads-source"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="direct_mail">Direct Mail</option>
            <option value="organic">Organic</option>
          </select>
          <button
            onClick={clearFilters}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Download Records</h2>
          {pagination && (
            <span className="text-sm text-slate-500">
              {pagination.total} total · Page {page} of {pagination.totalPages}
            </span>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : downloads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Downloads Found</h3>
            <p className="text-gray-500">Download records will appear here once users start downloading market reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Suburb</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Downloaded</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Tracking Code</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600">{item.email}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.suburb}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(item.downloaded_at).toLocaleDateString('en-NZ', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.source === 'direct_mail' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {item.source === 'direct_mail' ? '📮 Direct Mail' : '🌐 Organic'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {item.tracking_code || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
