'use client';

import { useSession } from 'next-auth/react';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SkeletonBookings } from '@/components/admin/Skeleton';
import { REGIONS, getCitiesByRegion, getSuburbsByCity, type Region } from '@/lib/geo-data';

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

interface LocationStat {
  region: string;
  city: string;
  suburb: string;
  count: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

export default function BookingsPage() {
  const { status } = useSession();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
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
  const availableSuburbs = cityFilter ? getSuburbsByCity(cityFilter) : [];

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
      setLocationStats(data.locationStats ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, regionFilter, cityFilter, suburbFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    if (status === 'authenticated') fetchBookings();
  }, [status, fetchBookings]);

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

  const totalBookings = pagination?.total ?? bookings.length;

  const summaryStats = useMemo(() => ({
    total: totalBookings,
    high: bookings.filter(b => b.priority === 'high').length,
    followUp: bookings.filter(b => {
      if (!b.next_follow_up_at) return false;
      return new Date(b.next_follow_up_at).toDateString() === new Date().toDateString();
    }).length,
  }), [bookings, totalBookings]);

  const locationHighlights = useMemo(() => {
    const pct = (count: number) => (totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0);

    const normalize = (value: string) => value.trim().toLowerCase();
    const countFor = (field: 'region' | 'city' | 'suburb', target: string) =>
      locationStats.reduce((sum, stat) => {
        const rawValue = String(stat[field] || '').trim().toLowerCase();
        if (rawValue === normalize(target)) {
          return sum + Number(stat.count || 0);
        }
        return sum;
      }, 0);

    const countForAny = (field: 'region' | 'city' | 'suburb', targets: string[]) =>
      targets.reduce((sum, target) => sum + countFor(field, target), 0);

    const aucklandCount = countForAny('region', ['Auckland']);
    const northShoreCount = countForAny('city', ['North Shore City', 'North Shore']);
    const northcrossCount = countForAny('suburb', ['Northcross']);

    return [
      { label: 'Auckland', count: aucklandCount, pct: pct(aucklandCount) },
      { label: 'North Shore', count: northShoreCount, pct: pct(northShoreCount) },
      { label: 'Northcross', count: northcrossCount, pct: pct(northcrossCount) },
    ];
  }, [locationStats, totalBookings]);

  // Build three-tier aggregation from locationStats returned by the API
  const geoStats = useMemo(() => {
    if (!locationStats.length) return { regions: [], cities: [], suburbs: [] };

    // Region totals
    const regionMap = new Map<string, number>();
    locationStats.forEach(s => {
      const key = String(s.region || 'Unknown').trim();
      regionMap.set(key, (regionMap.get(key) || 0) + s.count);
    });
    const regions = Array.from(regionMap.entries())
      .map(([region, count]) => ({ region, count, pct: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // City totals
    const cityMap = new Map<string, { region: string; count: number }>();
    locationStats.forEach(s => {
      const cityKey = String(s.city || 'Unknown').trim();
      const existing = cityMap.get(cityKey);
      if (existing) existing.count += s.count;
      else cityMap.set(cityKey, { region: String(s.region || 'Unknown').trim(), count: s.count });
    });
    const cities = Array.from(cityMap.entries())
      .map(([city, { region, count }]) => ({ city, region, count, pct: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Suburb totals
    const suburbs = locationStats
      .map(s => ({ suburb: String(s.suburb || 'Other').trim(), city: String(s.city || 'Unknown').trim(), region: String(s.region || 'Unknown').trim(), count: s.count, pct: totalBookings > 0 ? Math.round((s.count / totalBookings) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { regions, cities, suburbs };
  }, [locationStats, totalBookings]);

  if (status === 'loading') return <SkeletonBookings />;

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.msg}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">📅 Bookings</h1>
        <p className="text-gray-600 mt-1">Manage appraisal requests and client appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Bookings', value: summaryStats.total, color: 'text-slate-800' },
          { label: 'High Priority', value: summaryStats.high, color: 'text-red-600' },
          { label: 'Follow Up Today', value: summaryStats.followUp, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">📍 Location Highlights</h2>
            <p className="text-sm text-slate-500">Auckland, North Shore and Northcross totals with percentages</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {locationHighlights.map(item => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">{item.label}</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-900">{item.count}</span>
                <span className="text-sm font-medium text-slate-500">{item.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(geoStats.regions.length > 0 || locationStats.length === 0) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">📍 Geographic Breakdown</h2>

          {locationStats.length === 0 ? (
            <p className="text-sm text-slate-400">
              Location data will appear here after the database migration is run and new bookings are submitted with address selection.
            </p>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">By Region</h3>
                <div className="flex flex-wrap gap-3">
                  {geoStats.regions.map(r => (
                    <button
                      key={r.region}
                      onClick={() => { handleRegionChange(r.region); }}
                      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-4 py-2 transition-colors"
                    >
                      <span className="text-sm font-semibold text-blue-800">{r.region}</span>
                      <span className="text-lg font-bold text-blue-900">{r.count}</span>
                      <span className="text-xs text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">{r.pct}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">By City / District</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {geoStats.cities.map(c => (
                    <button
                      key={c.city}
                      onClick={() => {
                        setRegionFilter(c.region);
                        setCityFilter(c.city);
                        setSuburbFilter('');
                        setPage(1);
                      }}
                      className="text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg p-3 transition-colors"
                    >
                      <div className="text-xs text-slate-500 mb-1">{c.region}</div>
                      <div className="text-sm font-semibold text-slate-800 leading-tight">{c.city}</div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-bold text-indigo-700">{c.count}</span>
                        <span className="text-xs text-slate-400">bookings</span>
                        <span className="ml-auto text-xs font-medium text-indigo-500">{c.pct}%</span>
                      </div>
                      <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1">
                        <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">By Suburb (Top 10)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {geoStats.suburbs.map(s => (
                    <button
                      key={`${s.suburb}-${s.city}`}
                      onClick={() => {
                        setRegionFilter(s.region);
                        setCityFilter(s.city);
                        setSuburbFilter(s.suburb);
                        setPage(1);
                      }}
                      className="text-left bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-lg p-3 transition-colors"
                    >
                      <div className="text-xs text-slate-400 truncate">{s.city}</div>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5">{s.suburb}</div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-bold text-green-700">{s.count}</span>
                        <span className="text-xs text-slate-400">bookings</span>
                      </div>
                      <div className="flex justify-between items-center mt-1.5">
                        <div className="flex-1 bg-slate-200 rounded-full h-1 mr-2">
                          <div className="bg-green-500 h-1 rounded-full" style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-green-600 shrink-0">{s.pct}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">📋 Booking List</h2>
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading bookings…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
        ) : bookings.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No bookings found for the current filters.</div>
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
                <h3 className="text-xl font-bold text-slate-900">📋 Booking Details</h3>
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

            {/* All Fields Display */}
            <div className="space-y-6">
              {/* Client Information */}
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
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property Information */}
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

              {/* Sales Information */}
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
                    <span className="font-semibold text-slate-600">Language Preference:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.languagePreference || '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Heard From:</span>
                    <span className="ml-2 text-slate-800">{detailBooking.heardFrom || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Status & Tracking */}
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
                      {detailBooking.has_downloaded ? '✓ Yes' : '✗ No'}
                      {detailBooking.download_count ? ` (${detailBooking.download_count} times)` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Notes */}
              {detailBooking.agent_notes && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-2">Agent Notes</h4>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailBooking.agent_notes}</p>
                </div>
              )}
            </div>

            {/* Edit Section */}
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Update Booking</h4>
              
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
