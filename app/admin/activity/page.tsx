'use client';

import { useSession } from 'next-auth/react';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SkeletonBookings, SkeletonDownloads } from '@/components/admin/Skeleton';
import DispatchStatsPanel from '@/components/admin/DispatchStatsPanel';
import { REGIONS, getCitiesByRegion, type Region } from '@/lib/geo-data';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

type BookingStatus = 'new' | 'contacted' | 'scheduled' | 'appraised' | 'converted' | 'lost';
type BookingPriority = 'high' | 'medium' | 'low';

interface Booking {
  id: string;
  client_name: string;
  email: string;
  phone?: string;
  property_address: string;
  region?: string;
  city?: string;
  suburb: string;
  timeline?: string;
  motivation?: string;
  languagePreference?: string;
  heardFrom?: string;
  contact_status: BookingStatus;
  priority: BookingPriority;
  created_at: string;
  next_follow_up_at?: string;
  agent_notes?: string;
  has_downloaded?: boolean;
  download_count?: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

interface DownloadStats {
  total_downloads: string;
  this_month: string;
  unique_users: string;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  appraised: 'bg-indigo-100 text-indigo-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const PRIORITY_STYLES: Record<BookingPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'New', contacted: 'Contacted', scheduled: 'Scheduled',
  appraised: 'Appraised', converted: 'Converted', lost: 'Lost',
};

const PRIORITY_LABELS: Record<BookingPriority, string> = {
  high: 'High', medium: 'Medium', low: 'Low',
};

function fmtStatus(v: BookingStatus) { return STATUS_LABELS[v] ?? v; }
function fmtPriority(v: BookingPriority) { return PRIORITY_LABELS[v] ?? v; }

function AppraisalsTab() {

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);

  const availableCities = regionFilter ? getCitiesByRegion(regionFilter as Region) : [];
  const availableSuburbs = [...SUBURB_PRIORITY_ORDER];

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    setCityFilter('');
    setSuburbFilter('');
    setPage(1);
  };

  const handleCityChange = (value: string) => {
    setCityFilter(value);
    setSuburbFilter('');
    setPage(1);
  };

  const handleSuburbChange = (value: string) => {
    setSuburbFilter(value);
    setPage(1);
  };

  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>('new');
  const [editPriority, setEditPriority] = useState<BookingPriority>('medium');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (regionFilter) params.set('region', regionFilter);
      if (cityFilter) params.set('city', cityFilter);
      if (suburbFilter) params.set('suburb', suburbFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const res = await fetch(`/api/admin/bookings?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setBookings(data.data ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appraisals');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, regionFilter, cityFilter, suburbFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const openDetail = (b: Booking) => {
    setDetailBooking(b);
    setEditStatus(b.contact_status);
    setEditPriority(b.priority);
    setEditNotes(b.agent_notes ?? '');
    setEditFollowUp(b.next_follow_up_at ? b.next_follow_up_at.slice(0, 10) : '');
  };

  const saveDetail = async () => {
    if (!detailBooking) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${detailBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_status: editStatus, priority: editPriority, agent_notes: editNotes, follow_up_at: editFollowUp || null }),
      });
      if (!res.ok) throw new Error('Failed to save');
      showNotification('success', 'Changes saved successfully');
      setDetailBooking(null);
      fetchBookings();
    } catch { showNotification('error', 'Failed to save changes'); }
    finally { setSaving(false); }
  };

  const clearFilters = () => {
    setSearch(''); setRegionFilter(''); setCityFilter('');
    setSuburbFilter(''); setStatusFilter(''); setPriorityFilter(''); setPage(1);
  };

  const summaryStats = useMemo(() => ({
    total: pagination?.total ?? bookings.length,
    high: bookings.filter(b => b.priority === 'high').length,
    followUp: bookings.filter(b => {
      if (!b.next_follow_up_at) return false;
      return new Date(b.next_follow_up_at).toDateString() === new Date().toDateString();
    }).length,
  }), [bookings, pagination]);

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total', value: summaryStats.total, color: 'text-slate-800' },
          { label: 'High Priority', value: summaryStats.high, color: 'text-red-600' },
          { label: 'Follow Up Today', value: summaryStats.followUp, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Appraisal List</h2>
            <p className="text-sm text-slate-500">Search by client, email, property, region, city or suburb</p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Clear filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, email, property, region, city or suburb"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Region</span>
            <select
              aria-label="Region"
              value={regionFilter}
              onChange={(e) => { handleRegionChange(e.target.value); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All regions</option>
              {REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">City / District</span>
            <select
              aria-label="City / District"
              value={cityFilter}
              onChange={(e) => { handleCityChange(e.target.value); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All cities</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Suburb</span>
            <select
              aria-label="Suburb"
              value={suburbFilter}
              onChange={(e) => { handleSuburbChange(e.target.value); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All suburbs</option>
              {availableSuburbs.map(suburb => (
                <option key={suburb} value={suburb}>{suburb}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Status</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Priority</span>
            <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              <option value="">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading appraisals...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
        ) : bookings.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No appraisals found for the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Address</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Suburb</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Priority</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Created</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-800">{booking.client_name}</div>
                      <div className="text-xs text-slate-500">{booking.email}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{booking.property_address || '—'}</td>
                    <td className="px-3 py-3 text-slate-700">{booking.suburb || 'Other'}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[booking.contact_status]}`}>{fmtStatus(booking.contact_status)}</span></td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[booking.priority]}`}>{fmtPriority(booking.priority)}</span></td>
                    <td className="px-3 py-3 text-slate-700">{new Date(booking.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => openDetail(booking)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <button type="button" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" onClick={() => setPage(prev => prev + 1)} disabled={page >= pagination.totalPages} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Appraisal Details</h3>
                <p className="text-sm text-slate-500 mt-1">{detailBooking.client_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Client Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-600">Name:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.client_name}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Email:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.email}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Phone:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Created:</span>
                    <span className="ml-2 text-slate-800">
                      {new Date(detailBooking.created_at).toLocaleDateString('en-NZ', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Property Information</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-600">Address:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.property_address || '—'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <span className="font-semibold text-slate-600">Suburb:</span>
                      <span className="ml-2 text-slate-800">{detailBooking.suburb || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">City:</span>
                      <span className="ml-2 text-slate-800">{detailBooking.city || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Region:</span>
                      <span className="ml-2 text-slate-800">{detailBooking.region || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3">Sales Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-600">Timeline:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.timeline || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Motivation:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.motivation || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Language:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.languagePreference || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Heard From:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.heardFrom || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-3">Status & Tracking</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-600">Status:</span>
                    <span className={`ml-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[detailBooking.contact_status]}`}>
                      {fmtStatus(detailBooking.contact_status)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Priority:</span>
                    <span className={`ml-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[detailBooking.priority]}`}>
                      {fmtPriority(detailBooking.priority)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Next Follow-up:</span>
                    <span className="ml-2 text-slate-800">
                      {detailBooking.next_follow_up_at
                        ? new Date(detailBooking.next_follow_up_at).toLocaleDateString('en-NZ')
                        : '—'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Downloaded Report:</span>
                    <span className="ml-2 text-slate-800">
                      {detailBooking.has_downloaded ? 'Yes' : 'No'}
                      {detailBooking.download_count ? ` (${detailBooking.download_count} times)` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {detailBooking.agent_notes && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-2">Agent Notes</h4>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailBooking.agent_notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Update</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-slate-700">
                  <span className="mb-1 block">Status</span>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  <span className="mb-1 block">Priority</span>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as BookingPriority)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1 block">Agent Notes</span>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this client..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                <span className="mb-1 block">Next Follow-up Date</span>
                <input
                  type="date"
                  value={editFollowUp}
                  onChange={(e) => setEditFollowUp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setDetailBooking(null)}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDetail}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadsTab() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);

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
  }, [page, debouncedSearch, sourceFilter]);

  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
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
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or tracking code..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
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
              {pagination.total} total - Page {page} of {pagination.totalPages}
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

export default function ActivityPage() {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<'dispatch' | 'appraisals' | 'downloads'>('dispatch');

  // Track which tabs have ever been activated so we only mount them once (lazy)
  // and keep them mounted thereafter to avoid re-fetching on tab re-visits.
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['dispatch']));

  const activateTab = (tab: 'dispatch' | 'appraisals' | 'downloads') => {
    setActiveTab(tab);
    setMountedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  };

  if (status === 'loading') {
    return activeTab === 'dispatch' ? <div className="space-y-6"><div className="h-10 bg-slate-100 rounded-xl animate-pulse w-64" /><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"><div className="h-4 bg-slate-100 rounded w-16 mb-2 animate-pulse" /><div className="h-7 bg-slate-100 rounded w-12 animate-pulse" /></div>)}</div></div> : activeTab === 'appraisals' ? <SkeletonBookings /> : <SkeletonDownloads />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
        <p className="text-gray-600 mt-1">Campaign dispatch stats, appraisals, and report downloads</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          <button
            onClick={() => activateTab('dispatch')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dispatch'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            Dispatch Stats
          </button>
          <button
            onClick={() => activateTab('appraisals')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'appraisals'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            Appraisals
          </button>
          <button
            onClick={() => activateTab('downloads')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'downloads'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            Downloads
          </button>
        </nav>
      </div>

      {/* Tabs are rendered once and kept in DOM (hidden when inactive) to avoid
          re-fetching. Non-dispatch tabs only mount on first activation. */}
      <div className={activeTab === 'dispatch' ? '' : 'hidden'}><DispatchStatsPanel /></div>
      {mountedTabs.has('appraisals') && (
        <div className={activeTab === 'appraisals' ? '' : 'hidden'}><AppraisalsTab /></div>
      )}
      {mountedTabs.has('downloads') && (
        <div className={activeTab === 'downloads' ? '' : 'hidden'}><DownloadsTab /></div>
      )}
    </div>
  );
}
