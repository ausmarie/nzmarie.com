'use client';

export const dynamic = 'force-dynamic';

import { useSession } from 'next-auth/react';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { SkeletonOutreach, SkeletonOutreachCard, SkeletonOutreachListRow } from '@/components/admin/Skeleton';
import AddressAutocomplete from '@/components/property/AddressAutocomplete';
import { isAdmin } from '@/lib/permissions';
import { getFixedImageUrl } from '@/lib/google-maps';
import SendReportModal from './components/SendReportModal';
import DispatchHistoryDrawer from './components/DispatchHistoryDrawer';
import SentDateFilter from './components/SentDateFilter';
import TodayRunSection, { type TodayRunData } from './components/TodayRunSection';
import DynamicMapView from './components/DynamicMapView';
import OutreachMapSidebar from './components/OutreachMapSidebar';
import {
  FaBed,
  FaBath,
  FaCar,
  FaRulerCombined,
  FaHistory,
  FaPaperPlane,
} from 'react-icons/fa';
import { aggregateLikedStreets, filterLikedItemsByStreet, extractStreetFromLikedItem } from '@/lib/liked-street-filter';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';
import { openGoogleMaps, buildPropertyAddress } from '@/lib/clipboard';

interface OutreachProperty {
  id: string;
  property_address: string;
  suburb: string;
  city: string;
  region: string;
  street?: string;
  owner_name?: string;
  property_type?: string;
  campaign: string;
  status: 'pending' | 'sent' | 'interacted' | 'converted' | 'liked';
  sent_at?: string;
  last_sent_at?: string;
  total_send_count?: number;
  last_campaign?: string;
  interacted_at?: string;
  converted_at?: string;
  created_at: string;
  notes?: string;
  property_url?: string | null;
  realestate_url?: string | null;
  image_url?: string | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  car_spaces?: number | null;
  floor_area?: string | null;
  land_area?: string | number | null;
  last_sold_price?: number | null;
  last_sold_date?: string | null;
  capital_value?: number | null;
  build_year?: number | null;
  pv_url?: string | null;
  property_history?: string | null;
  joined_property_id?: string | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  suburb_median_price?: number | null;
  suburb_days_on_market?: number | null;
  on_market_sale?: boolean;
  sale_listing_status?: string | null;
  sale_price?: string | null;
  sale_agent?: string | null;
  on_market_rent?: boolean;
  rent_listing_status?: string | null;
  rent_price?: string | null;
  latest_send_title?: string | null;
  latest_sent_at?: string | null;
  latest_campaign?: string | null;
  latest_send_quarter?: string | null;
  latest_send_year?: number | null;
  latest_send_report_suburb?: string | null;
  no_junk_mail?: boolean;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  liked: 'Liked',
  pending: 'Pending',
  sent: 'Sent',
  interacted: 'Interacted',
  converted: 'Converted',
};

const STATUS_COLORS: Record<string, string> = {
  liked: 'bg-pink-50 text-pink-600 border-pink-200',
  pending: 'bg-blue-50 text-blue-600 border-blue-200',
  sent: 'bg-purple-50 text-purple-600 border-purple-200',
  interacted: 'bg-orange-50 text-orange-600 border-orange-200',
  converted: 'bg-green-50 text-green-600 border-green-200',
};

const CARD_PAGE_SIZE = 9;
const LIST_PAGE_SIZE = 18;

function todayDateKey(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface PropertyHistoryRecord {
  date?: string;
  type?: string;
  price?: string;
  agent?: string;
  interval?: string;
}

function PropertyHistoryView({ raw }: { raw: string }) {
  if (!raw || !raw.trim()) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#a0aec0', backgroundColor: '#f8fafc',
      }}>
        No property history available
      </div>
    );
  }

  let records: PropertyHistoryRecord[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) records = parsed as PropertyHistoryRecord[];
  } catch {
    records = [];
  }

  if (records.length === 0) {
    return (
      <div style={{
        padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: '8px',
        fontSize: '0.9rem', color: '#2D3748', whiteSpace: 'pre-wrap',
        fontFamily: 'monospace', backgroundColor: '#f8fafc',
      }}>
        {raw}
      </div>
    );
  }

  const typeColor: Record<string, string> = {
    SOLD: '#dc2626',
    Listed: '#2563eb',
    Rented: '#0891b2',
    Built: '#16a34a',
  };

  return (
    <div style={{
      border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden',
      fontSize: '0.85rem', backgroundColor: '#f8fafc',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 90px 1fr',
        backgroundColor: '#edf2f7', fontWeight: '700', color: '#4a5568',
        padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
      }}>
        <span>Date</span>
        <span>Type</span>
        <span>Price / Detail</span>
      </div>
      {records.map((rec, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '120px 90px 1fr',
          padding: '8px 12px', borderBottom: i < records.length - 1 ? '1px solid #edf2f7' : 'none',
          color: '#2D3748',
        }}>
          <span style={{ fontFamily: 'monospace' }}>{rec.date || '—'}</span>
          <span style={{ fontWeight: '600', color: typeColor[rec.type || ''] || '#4a5568' }}>
            {rec.type || '—'}
          </span>
          <span style={{ fontFamily: 'monospace' }}>
            {rec.price ? rec.price : '—'}
            {rec.interval ? <span style={{ color: '#a0aec0', marginLeft: '8px', fontFamily: 'inherit' }}>({rec.interval})</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OutreachPage() {
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState<'liked' | 'pending' | 'sent'>('liked');
  const [items, setItems] = useState<OutreachProperty[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [paginationMode, setPaginationMode] = useState<'infinite' | 'classic'>('infinite');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [classicItems, setClassicItems] = useState<OutreachProperty[]>([]);
  const [classicPagination, setClassicPagination] = useState<PaginationMeta | null>(null);
  const [classicLoading, setClassicLoading] = useState(false);
  // Caches the last known valid total so that during a Classic Pages transition
  // (page change or viewMode switch) where classicPagination briefly holds stale/0
  // data, totalPages never drops to 0, preventing "Displaying 10 to 0 of 0"
  // and "Page 2 of 1" display glitches.
  const lastValidTotalRef = useRef<number>(0);

  // Tracks image load failures (e.g. /static/media/no-photo-available.png) so we can
  // fall back to the "No Image Available" placeholder, matching the Properties page.
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const handleImageError = useCallback((id: string) => {
    setImageErrors((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const [addressInput, setAddressInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('Northcross');
  const [streetFilter, setStreetFilter] = useState('');
  const [runStreetFilter, setRunStreetFilter] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [lastSoldPreset, setLastSoldPreset] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState<'house' | 'all' | 'townhouse'>('all');
  const [marketStatus, setMarketStatus] = useState<'all' | 'for_sale' | 'for_rent' | 'rented' | 'never_rented' | 'not_listed'>('all');
  const [junkFilter, setJunkFilter] = useState<'all' | 'no_junk' | 'allow_junk'>('all');

  const [likedStreetModeApplied, setLikedStreetModeApplied] = useState(false);
  const [likedSelectedStreet, setLikedSelectedStreet] = useState('');
  const [likedStreetSearch, setLikedStreetSearch] = useState('');
  const [likedStreetsVisible, setLikedStreetsVisible] = useState(5);
  const [likedStartStreet, setLikedStartStreet] = useState('');

  // API-backed street data for the Filter by Street panel
  const [likedApiStreets, setLikedApiStreets] = useState<Array<{ street: string; count: number }>>([]);
  // Greedy nearest-neighbour ordered list of all streets (excluding start street itself).
  // Populated when a start street is chosen; each step uses the lowest-house-number
  // address coordinate so the order reflects natural walking sequence.
  const [likedOrderedStreets, setLikedOrderedStreets] = useState<Array<{ street: string; count: number; distance_m: number }>>([]);
  const [likedApiLoading, setLikedApiLoading] = useState(false);

  const [reportSuburbFilter, setReportSuburbFilter] = useState('');
  const [activeQuarter, setActiveQuarter] = useState('');
  const [sentStatusFilter, setSentStatusFilter] = useState<'all' | 'sent' | 'unsent'>('all');
  const [sortMode, setSortMode] = useState<'address' | 'time'>('address');
  const [sentDateFilter, setSentDateFilter] = useState<string[]>([todayDateKey()]);
  const [availableReports, setAvailableReports] = useState<Array<{ suburb: string; quarter: string; year: number; id: string; uploaded_at: string }>>([]);

  // Today's Run: shared street-clusters data (fetched when Pending + Unsent).
  const [todayRunBudget, setTodayRunBudget] = useState<number>(() => {
    if (typeof window === 'undefined') return 30;
    const stored = window.localStorage.getItem('today_run_budget_v2');
    const n = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 30;
  });
  const [todayRunData, setTodayRunData] = useState<TodayRunData | null>(null);
  const [todayRunLoading, setTodayRunLoading] = useState(false);
  const [todayRunError, setTodayRunError] = useState<string | null>(null);
  const [todayRunRefreshKey, setTodayRunRefreshKey] = useState(0);
  const [todayRunStartStreet, setTodayRunStartStreet] = useState<string>('');
  // Tracks the (suburb + quarter) the current Today's Run street set belongs to.
  // When either changes, the previously auto-selected run streets must be cleared
  // so the list fetch for the new suburb/quarter can't be filtered by the old
  // suburb's streets (which would return zero addresses and show "Displaying 1 to
  // 0 of 0 properties" while the new street-clusters data is loading).
  const todayRunSuburbQuarterRef = useRef<string>('');

  useEffect(() => {
    window.localStorage.setItem('today_run_budget_v2', String(todayRunBudget));
  }, [todayRunBudget]);

  // Debounce filter changes: only trigger fetch after 300ms of filter stability
  const [debouncedFilterKey, setDebouncedFilterKey] = useState(0);
  const filterDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      cacheRef.current.clear();
      setCurrentPage(1);
      setDebouncedFilterKey(k => k + 1);
    }, 300);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [activeTab, suburbFilter, streetFilter, runStreetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, junkFilter, lastSoldPreset, reportSuburbFilter, sentStatusFilter, sortMode, sentDateFilter, likedStartStreet, activeQuarter]);

  // The "Today's Run" planner auto-selects the first run's streets whenever
  // "Unsent" mode loads its street-cluster data (sets runStreetFilter to that
  // run's ~28 streets). Without clearing it, switching back to "All"/"Sent"
  // would keep filtering the full list to those few streets, showing a wrong
  // "Displaying X of Y" total. Clear the run street set whenever we leave
  // "Unsent" so "All" reflects every address (unsent + sent).
  useEffect(() => {
    if (sentStatusFilter === 'unsent') return;
    setRunStreetFilter([]);
    setStreetFilter('');
  }, [sentStatusFilter]);

  useEffect(() => {
    if (activeTab !== 'sent' || availableReports.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/pdf/reports?status=active');
        if (res.ok) {
          const data = await res.json();
          const reports = (data.reports || []).map((r: { suburb: string; quarter: string; year: number; id: string; uploaded_at?: string }) => ({
            suburb: r.suburb, quarter: r.quarter, year: r.year, id: r.id, uploaded_at: r.uploaded_at || '',
          }));
          if (!cancelled) setAvailableReports(reports);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeTab, availableReports.length]);

  const sentQuarterOptions = useMemo(() => {
    const latestByQuarter = new Map<string, string>();
    for (const r of availableReports) {
      const label = `${r.year}-${r.quarter}`;
      const ts = r.uploaded_at || '';
      const cur = latestByQuarter.get(label);
      if (cur === undefined || ts > cur) latestByQuarter.set(label, ts);
    }
    return [...latestByQuarter.entries()]
      .sort((a, b) => (b[1] || '').localeCompare(a[1] || '') || b[0].localeCompare(a[0]))
      .map(([q]) => q);
  }, [availableReports]);

  const [viewMode, setViewMode] = useState<'card' | 'list' | 'map'>('card');
  const pageSize = viewMode === 'list' ? LIST_PAGE_SIZE : CARD_PAGE_SIZE;
  const [collapsedStreets, setCollapsedStreets] = useState<Set<string>>(new Set());

  // Map mode state
  const [activeMapRunId, setActiveMapRunId] = useState<number | null>(null);
  const [activeMapStreet, setActiveMapStreet] = useState<string | null>(null);
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | 'unsent' | 'sent' | 'junk'>('all');
  const [mapSidebarHidden, setMapSidebarHidden] = useState<boolean>(false);
  const [mapStreetStatusMap, setMapStreetStatusMap] = useState<Map<string, 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending'>>(new Map());
  const [mapAddressCounts, setMapAddressCounts] = useState<{ total: number; unsent: number; sent: number; junk: number } | null>(null);
  const handleMapCoordsLoaded = useCallback((
    sm: Map<string, 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending'>,
    counts: { total: number; unsent: number; sent: number; junk: number }
  ) => {
    setMapStreetStatusMap(sm);
    setMapAddressCounts(counts);
  }, []);
  useEffect(() => {
    window.localStorage.setItem('outreach_map_sidebar_hidden', mapSidebarHidden ? '1' : '0');
  }, [mapSidebarHidden]);
  // Reset to card view when leaving pending tab
  useEffect(() => {
    if (activeTab !== 'pending') setViewMode((v) => (v === 'map' ? 'card' : v));
  }, [activeTab]);
  const [selectedByTab, setSelectedByTab] = useState<Record<string, Set<string>>>({
    liked: new Set(),
    pending: new Set(),
    sent: new Set(),
  });
  const selected = selectedByTab[activeTab];
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const canMarkAsSent = isAdmin(session?.user?.email ?? '');

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTargetIds, setSendTargetIds] = useState<string[]>([]);
  const [sendTargetSuburb, setSendTargetSuburb] = useState('');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
  const [historyTargetAddress, setHistoryTargetAddress] = useState<string>('');

  const openSendModal = (ids?: string[]) => {
    const targets = selected.size > 0 ? Array.from(selected) : ids || Array.from(selected);
    if (targets.length === 0) return;
    // Derive the report suburb from the selected target addresses so the
    // modal defaults to that suburb's quarterly report set (e.g. "Torbay 2026 Q2").
    const suburbs = new Set(
      targets
        .map((id) => items.find((p) => p.id === id)?.suburb)
        .filter((s): s is string => Boolean(s))
    );
    setSendTargetSuburb(suburbs.size === 1 ? [...suburbs][0] : '');
    setSendTargetIds(targets);
    setSendModalOpen(true);
  };

  const openHistoryDrawer = (id: string, address: string) => {
    setHistoryTargetId(id);
    setHistoryTargetAddress(address);
    setHistoryDrawerOpen(true);
  };

  // Convert to Lead modal
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingProperty, setConvertingProperty] = useState<OutreachProperty | null>(null);
  const [convertForm, setConvertForm] = useState({ owner_email: '', owner_phone: '', summary: '', notes: '' });
  const [converting, setConverting] = useState(false);

  const openConvertModal = (prop: OutreachProperty) => {
    setConvertingProperty(prop);
    setConvertForm({
      owner_email: '',
      owner_phone: '',
      summary: '',
      notes: prop.notes || '',
    });
    setConvertModalOpen(true);
  };

  const handleConvertToLead = async () => {
    if (!convertingProperty) return;
    setConverting(true);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_address: convertingProperty.property_address,
          property_id: convertingProperty.joined_property_id || null,
          street: convertingProperty.street,
          suburb: convertingProperty.suburb,
          city: convertingProperty.city,
          region: convertingProperty.region,
          owner_name: convertingProperty.owner_name,
          owner_email: convertForm.owner_email || null,
          owner_phone: convertForm.owner_phone || null,
          source: 'outreach',
          source_outreach_id: convertingProperty.id,
          status: 'new',
          priority: 'medium',
          summary: convertForm.summary || null,
          notes: convertForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to convert');
      showNotification('success', `Lead created for ${convertingProperty.property_address}`);
      setConvertModalOpen(false);
      setConvertingProperty(null);
      window.scrollTo(0, 0);
    } catch {
      showNotification('error', 'Failed to convert to lead');
    } finally {
      setConverting(false);
    }
  };

  // Edit Property modal (edits the linked properties table record)
  const [editingProperty, setEditingProperty] = useState<OutreachProperty | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [sendHistory, setSendHistory] = useState<Array<{
    log_id: string; report_title: string; campaign_key: string;
    sent_at: string; sent_by: string; notes?: string;
    pdf_file_url?: string; pdf_file_name?: string; scan_count: number;
  }>>([]);
  const [sendHistoryLoading, setSendHistoryLoading] = useState(false);

  const openEditModal = async (prop: OutreachProperty) => {
    setEditingProperty(prop);
    setEditFormData({
      address: prop.property_address || '',
      suburb: prop.suburb || '',
      city: prop.city || '',
      region: prop.region || '',
      bedrooms: prop.bedrooms?.toString() || '',
      bathrooms: prop.bathrooms?.toString() || '',
      car_spaces: prop.car_spaces?.toString() || '',
      year_built: prop.build_year?.toString() || '',
      floor_size: prop.floor_area || '',
      land_area: prop.land_area?.toString() || '',
      last_sold_price: prop.last_sold_price?.toString() || '',
      last_sold_date: prop.last_sold_date ? prop.last_sold_date.split('T')[0] : '',
      capital_value: prop.capital_value?.toString() || '',
      property_url: prop.pv_url || prop.property_url || '',
      cover_image_url: prop.image_url || '',
      description: prop.description || '',
      property_history: prop.property_history || '',
    });
    setSendHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/outreach/${prop.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setSendHistory(data.history || []);
      } else {
        setSendHistory([]);
      }
    } catch {
      setSendHistory([]);
    } finally {
      setSendHistoryLoading(false);
    }
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingProperty?.joined_property_id) {
      showNotification('error', 'No linked property record to edit');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(editFormData)) {
        payload[key] = value === '' || value === undefined ? null : value;
      }
      const response = await fetch(`/api/admin/properties/${editingProperty.joined_property_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update property');

      // 同步更新 outreach_properties（确保 MV 和 list view 显示最新地址）
      const outreachPayload: Record<string, string | null> = {};
      if (payload.address !== undefined) outreachPayload.property_address = payload.address as string | null;
      if (payload.suburb !== undefined) outreachPayload.suburb = payload.suburb as string | null;
      if (payload.city !== undefined) outreachPayload.city = payload.city as string | null;
      if (payload.region !== undefined) outreachPayload.region = payload.region as string | null;
      if (Object.keys(outreachPayload).length > 0) {
        fetch(`/api/admin/outreach/${editingProperty.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outreachPayload),
        }).catch(() => { });
      }

      // 更新本地列表数据（infinite + classic 两种模式都处理）
      const updatedAddress = (payload.address as string) ?? editingProperty.property_address;
      const updateItem = (item: OutreachProperty): OutreachProperty => {
        if (item.id !== editingProperty.id) return item;
        return {
          ...item,
          property_address: updatedAddress,
          suburb: (payload.suburb as string) ?? item.suburb,
          city: (payload.city as string) ?? item.city,
          region: (payload.region as string) ?? item.region,
          bedrooms: payload.bedrooms !== undefined && payload.bedrooms !== null ? Number(payload.bedrooms) : item.bedrooms,
          bathrooms: payload.bathrooms !== undefined && payload.bathrooms !== null ? Number(payload.bathrooms) : item.bathrooms,
          car_spaces: payload.car_spaces !== undefined && payload.car_spaces !== null ? Number(payload.car_spaces) : item.car_spaces,
          build_year: payload.year_built !== undefined && payload.year_built !== null ? Number(payload.year_built) : item.build_year,
          floor_area: (payload.floor_size as string) ?? item.floor_area,
          land_area: (payload.land_area as string | number | null) ?? item.land_area,
          last_sold_price: payload.last_sold_price !== undefined && payload.last_sold_price !== null ? Number(payload.last_sold_price) : item.last_sold_price,
          last_sold_date: (payload.last_sold_date as string) ?? item.last_sold_date,
          capital_value: payload.capital_value !== undefined && payload.capital_value !== null ? Number(payload.capital_value) : item.capital_value,
          image_url: (payload.cover_image_url as string) ?? item.image_url,
          description: (payload.description as string) ?? item.description,
          property_history: (payload.property_history as string) ?? item.property_history,
        };
      };

      // 清除缓存，防止旧数据覆盖
      cacheRef.current.clear();
      setItems((prev) => prev.map(updateItem));
      setClassicItems((prev) => prev.map(updateItem));

      showNotification('success', 'Property updated successfully');
      setEditingProperty(null);
      window.scrollTo(0, 0);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  const isClassic = paginationMode === 'classic';
  const displayItems = isClassic ? classicItems : items;

  // Fetch all liked streets for the current suburb from the API (called on Apply).
  const fetchLikedStreets = useCallback(async (suburb: string) => {
    if (!suburb) return;
    setLikedApiLoading(true);
    try {
      const res = await fetch(`/api/admin/outreach/liked-streets?suburb=${encodeURIComponent(suburb)}`);
      if (res.ok) {
        const data = await res.json();
        setLikedApiStreets(data.all_streets ?? []);
      }
    } catch {
      // silently fall back to client-derived list
    } finally {
      setLikedApiLoading(false);
    }
  }, []);

  // Fetch the greedy-ordered full street list for the chosen start street.
  const fetchLikedOrderedStreets = useCallback(async (suburb: string, startStreet: string) => {
    if (!suburb || !startStreet) {
      setLikedOrderedStreets([]);
      return;
    }
    try {
      const params = new URLSearchParams({ suburb, start_street: startStreet });
      const res = await fetch(`/api/admin/outreach/liked-streets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLikedOrderedStreets(data.ordered_streets ?? []);
      }
    } catch {
      setLikedOrderedStreets([]);
    }
  }, []);
  const displayPagination = isClassic ? classicPagination : pagination;
  const rawDisplayTotal = displayPagination?.total || 0;
  // Keep the last non-zero total from BOTH pagination sources (the one
  // currently displayed and the other mode's) so a later infinite/classic
  // switch can never drop the "of N properties" counter back to "0" — e.g.
  // when Classic Pages just fetched total=134 but Infinite Scroll's pagination
  // is briefly stale/0.
  if (pagination?.total) lastValidTotalRef.current = pagination.total;
  if (classicPagination?.total) lastValidTotalRef.current = classicPagination.total;
  const stableDisplayTotal = rawDisplayTotal > 0 ? rawDisplayTotal : lastValidTotalRef.current;
  const totalPages = Math.max(1, Math.ceil(stableDisplayTotal / pageSize));
  const availableStreets = useMemo(() => {
    const streets = new Set<string>();
    displayItems.forEach(item => {
      if (item.street) streets.add(item.street);
    });
    return Array.from(streets).sort();
  }, [displayItems]);

  // Always compute the street summary when on the liked tab so the list is
  // ready the instant Apply is clicked (no re-fetch race condition).
  const likedStreetsSummary = useMemo(() => {
    if (activeTab !== 'liked') return [];
    return aggregateLikedStreets(displayItems, likedStreetSearch);
  }, [displayItems, activeTab, likedStreetSearch]);

  const filteredLikedItems = useMemo(() => {
    if (activeTab !== 'liked' || !likedStreetModeApplied || !likedSelectedStreet) return null;
    return filterLikedItemsByStreet(displayItems, likedSelectedStreet);
  }, [displayItems, activeTab, likedStreetModeApplied, likedSelectedStreet]);

  const likedStreetTotalCount = likedStreetModeApplied && likedSelectedStreet
    ? likedStreetsSummary.find((s) => s.street === likedSelectedStreet)?.count ?? 0
    : displayPagination?.total || lastValidTotalRef.current || displayItems.length;
  const likedStreetDisplayCount = likedStreetModeApplied && likedSelectedStreet
    ? filteredLikedItems?.length ?? 0
    : displayItems.length;

  // Streets ordered around the Start street (alphabetical, wrapping): the
  // chosen/previous start street becomes the first street, followed by the
  // rest alphabetically. With no start street selected the plain alphabetical
  // order is used, so the first (alphabetically-first) street shows first.
  const likedStreetsOrdered = useMemo(() => {
    if (likedStreetsSummary.length === 0) return [];
    const idx = likedStartStreet
      ? likedStreetsSummary.findIndex((s) => s.street === likedStartStreet)
      : 0;
    const start = idx === -1 ? 0 : idx;
    return [...likedStreetsSummary.slice(start), ...likedStreetsSummary.slice(0, start)];
  }, [likedStreetsSummary, likedStartStreet]);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Client-side cache: keyed by filter signature + page number so that
  // infinite and classic modes share the same per-page cache. Switching between
  // modes for the same page hits the cache instantly (no network round-trip).
  interface CacheEntry {
    items: OutreachProperty[];
    pagination: PaginationMeta | null;
    hasMore: boolean;
  }
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const fetchItemsRef = useRef<(() => Promise<void>) | null>(null);
  const buildCacheKey = useCallback((page: number) => {
    return [
      activeTab, suburbFilter, streetFilter, runStreetFilter.join(','), campaignFilter,
      debouncedSearch, sortOrder, propertyFilter, marketStatus, junkFilter, lastSoldPreset,
      reportSuburbFilter, sentStatusFilter, sortMode,
      sentDateFilter.join(','),
      likedStreetModeApplied ? `start:${likedStartStreet}` : '',
      `v:${pageSize}`,
      `p${page}`,
      `q:${activeQuarter || 'none'}`,
    ].join('|');
  }, [activeTab, suburbFilter, streetFilter, runStreetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, junkFilter, lastSoldPreset, reportSuburbFilter, sentStatusFilter, sortMode, sentDateFilter, likedStreetModeApplied, likedStartStreet, pageSize, activeQuarter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(addressInput), 500);
    return () => clearTimeout(t);
  }, [addressInput]);

  const fetchPageData = useCallback(async (pageNum: number): Promise<{ items: OutreachProperty[]; pagination: PaginationMeta | null; effectiveLimit: number }> => {
    // Cancel any in-flight request so a slower earlier request can't
    // overwrite the result of a newer filter/tab/page change.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // When a Today's Run street set is active, fetch ALL addresses in that run
    // in a single request. Runs typically have 20–50 addresses across 10–15
    // streets. Using PAGE_SIZE (18) here would cut off later streets because
    // the API sorts alphabetically, so geographic-first streets like
    // "Glamorgan Drive" would never appear on page 1 when A-C streets fill it.
    // When the Liked street planner is active we load the whole suburb's liked
    // set so the Start street selector and street list see EVERY street.
    const effectiveLimit =
      activeTab === 'liked' && likedStreetModeApplied ? 1000
        : runStreetFilter.length > 0 ? 500
          : pageSize;

    const params = new URLSearchParams({
      status: activeTab,
      page: pageNum.toString(),
      limit: effectiveLimit.toString(),
      sortOrder,
    });
    const effectiveSuburb = reportSuburbFilter || suburbFilter;
    if (effectiveSuburb) params.set('suburb', effectiveSuburb);
    // When liked street planner is active, don't send street= to the API.
    // The planner needs ALL streets for the suburb to populate the dropdown;
    // per-street display is handled client-side via likedSelectedStreet.
    if (streetFilter && !(activeTab === 'liked' && likedStreetModeApplied)) params.set('street', streetFilter);
    if (runStreetFilter.length > 0) params.set('streets', runStreetFilter.join(','));
    if (campaignFilter) params.set('campaign', campaignFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (propertyFilter === 'house') params.set('standalone_only', 'true');
    if (propertyFilter === 'townhouse') params.set('townhouse_only', 'true');
    if (marketStatus !== 'all') params.set('market_status', marketStatus);
    if (junkFilter !== 'all') params.set('no_junk_mail', junkFilter === 'no_junk' ? 'true' : 'false');
    if (lastSoldPreset === 'none') {
      params.set('last_sold_none', 'true');
    } else if (lastSoldPreset !== 'all') {
      // Parse preset like '5-10', '3-5', '0-3', '10-15', '15+'
      const parts = lastSoldPreset.split('-');
      if (parts.length === 2) {
        params.set('last_sold_min_years', parts[0]);
        params.set('last_sold_max_years', parts[1]);
      } else if (lastSoldPreset === '15+') {
        params.set('last_sold_min_years', '15');
      }
    }
    if (sentStatusFilter) params.set('sent_status', sentStatusFilter);
    if (activeQuarter) params.set('report_quarter', activeQuarter);
    if (sortMode === 'time') params.set('sort_mode', 'time');
    if (activeTab === 'sent' && sentDateFilter.length > 0) params.set('sent_dates', sentDateFilter.join(','));
    if (activeTab === 'liked' && likedStreetModeApplied && likedStartStreet) params.set('start_street', likedStartStreet);

    const res = await fetch(`/api/admin/outreach?${params}`, { signal: controller.signal });
    if (controller.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    return {
      items: (data.data ?? []).map((item: OutreachProperty) => ({
        ...item,
        status: normalizeStatus(item.status),
      })),
      pagination: data.pagination ?? null,
      effectiveLimit,
    };
  }, [activeTab, suburbFilter, streetFilter, runStreetFilter, campaignFilter, debouncedSearch, sortOrder, propertyFilter, marketStatus, junkFilter, lastSoldPreset, reportSuburbFilter, sentStatusFilter, sortMode, sentDateFilter, likedStreetModeApplied, likedStartStreet, pageSize, activeQuarter]);

  const fetchItems = useCallback(async () => {
    if (isClassic) return;
    const key1 = buildCacheKey(1);
    const cached1 = cacheRef.current.get(key1);
    if (cached1) {
      // Accumulate all cached consecutive pages for infinite scroll
      const allItems = [...cached1.items];
      let page = 2;
      let lastTotal = cached1.pagination?.total || lastValidTotalRef.current || cached1.items.length;
      while (true) {
        const ck = buildCacheKey(page);
        const cp = cacheRef.current.get(ck);
        if (!cp) break;
        allItems.push(...cp.items);
        // Page 2+ responses carry total 0 (the API only counts on page 1),
        // so fall back to the last known non-zero total instead of zeroing it.
        lastTotal = cp.pagination?.total || lastTotal;
        page++;
      }
      setItems(allItems);
      setPagination(cached1.pagination ? { ...cached1.pagination, total: lastTotal } : null);
      setHasMore(cached1.hasMore);
      hasMoreRef.current = cached1.hasMore;
      pageRef.current = page - 1;
      setLoading(false);
      return;
    }
    setLoading(true);
    pageRef.current = 1;
    setHasMore(true);
    hasMoreRef.current = true;
    try {
      const result = await fetchPageData(1);
      cacheRef.current.set(key1, {
        items: result.items,
        pagination: result.pagination,
        hasMore: result.items.length >= result.effectiveLimit,
      });
      setItems(result.items);
      setPagination(result.pagination);
      if (result.items.length < result.effectiveLimit) {
        setHasMore(false);
        hasMoreRef.current = false;
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Error fetching outreach:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchPageData, isClassic, buildCacheKey]);

  // Keep fetchItemsRef pointing to the latest fetchItems so effects that
  // intentionally omit it from deps (auth, debounce-key) always call the
  // version that closes over the current runStreetFilter / fetchPageData.
  useEffect(() => {
    fetchItemsRef.current = fetchItems;
  });

  // Auth effect: call fetchItems() directly on mount/status change. The
  // initial fetchItems (with empty runStreetFilter) is correct here because
  // this effect only fires once on mount (status goes to 'authenticated').
  useEffect(() => {
    if (status === 'authenticated') fetchItems();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce-key effect: use fetchItemsRef so the latest fetchItems (with
  // the current runStreetFilter) is always called, avoiding stale closures
  // that would fetch with an empty street filter.
  useEffect(() => {
    if (status !== 'authenticated' || debouncedFilterKey === 0) return;
    fetchItemsRef.current?.();
  }, [debouncedFilterKey, status]);

  useEffect(() => {
    if (!isClassic || status !== 'authenticated') return;
    const key = buildCacheKey(currentPage);
    const cached = cacheRef.current.get(key);
    if (cached) {
      // Instant restore from cache — no loading state, no network.
      setClassicItems(cached.items);
      setClassicPagination(cached.pagination);
      setClassicLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setClassicLoading(true);
      try {
        const result = await fetchPageData(currentPage);
        if (!cancelled) {
          cacheRef.current.set(key, {
            items: result.items,
            pagination: result.pagination,
            hasMore: result.items.length >= result.effectiveLimit,
          });
          setClassicItems(result.items);
          setClassicPagination(result.pagination);
        }
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Error fetching outreach (classic):', error);
        }
      } finally {
        if (!cancelled) setClassicLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isClassic, currentPage, debouncedFilterKey, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCurrentPage(1);
  }, [paginationMode, viewMode]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const key = buildCacheKey(nextPage);
    // The API only computes the real total on page 1 (offset 0); subsequent
    // pages return total 0 to avoid a full-table COUNT on every infinite-scroll
    // request. Keep the last known non-zero total so the "of N properties"
    // counter never shows "of 0" after more pages load.
    const mergePaginationTotal = (prev: PaginationMeta | null, next: PaginationMeta | null): PaginationMeta | null => {
      if (!next) return prev;
      const known = prev?.total || lastValidTotalRef.current || 0;
      return { ...next, total: next.total > 0 ? next.total : known };
    };
    const cached = cacheRef.current.get(key);
    if (cached) {
      setItems((prev) => [...prev, ...cached.items]);
      pageRef.current = nextPage;
      setPagination((prev) => mergePaginationTotal(prev, cached.pagination));
      setHasMore(cached.hasMore);
      hasMoreRef.current = cached.hasMore;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }
    try {
      const result = await fetchPageData(nextPage);
      cacheRef.current.set(key, {
        items: result.items,
        pagination: result.pagination,
        hasMore: result.items.length >= result.effectiveLimit,
      });
      setItems((prev) => [...prev, ...result.items]);
      pageRef.current = nextPage;
      if (result.items.length < result.effectiveLimit) {
        setHasMore(false);
        hasMoreRef.current = false;
      }
      setPagination((prev) => mergePaginationTotal(prev, result.pagination));
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Error loading more:', error);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPageData, buildCacheKey]);

  useEffect(() => {
    if (isClassic) return;
    const el = lastPropertyElementRef.current;
    if (!el || !hasMore || loadingMore || loading) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    try {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          loadMore();
        }
      }, { rootMargin: '400px 0px' });
      if (typeof observer?.observe === 'function') {
        observer.observe(el);
        return () => {
          try {
            observer.disconnect?.();
          } catch {
          }
        };
      }
    } catch {
    }
  }, [hasMore, loadingMore, loading, loadMore, isClassic, viewMode]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const normalizeStatus = (status?: unknown) => {
    const value = String(status ?? '').toLowerCase();
    if (value === 'liked' || value === 'pending' || value === 'sent' || value === 'interacted' || value === 'converted') {
      return value as OutreachProperty['status'];
    }
    return 'pending';
  };

  const handleMarkAsSentSuccess = () => {
    cacheRef.current.clear();
    if (isClassic) {
      setCurrentPage(currentPage);
    } else {
      fetchItems();
    }
    window.scrollTo(0, 0);
  };

  const toggleStreet = (suburb: string, street: string) => {
    const key = `${suburb}::${street}`;
    setCollapsedStreets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedByTab((prev) => {
      const current = prev[activeTab];
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [activeTab]: next };
    });
  };

  const clearSelected = () => {
    setSelectedByTab((prev) => ({ ...prev, [activeTab]: new Set() }));
  };

  const markAsSent = () => {
    if (selected.size === 0) return;
    openSendModal();
  };

  const markAsPending = async () => {
    if (selected.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selected).map(async (id) => {
          const response = await fetch(`/api/admin/outreach/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error || 'Failed to mark as pending');
          return data.data as OutreachProperty;
        })
      );
      if (results.length === 0) return;
      showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending`);
      clearSelected();
      handleMarkAsSentSuccess();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  const markAsLiked = async () => {
    if (selected.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selected).map(async (id) => {
          const response = await fetch(`/api/admin/outreach/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'liked' }),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error || 'Failed to move to Liked');
          return data.data as OutreachProperty;
        })
      );
      if (results.length === 0) return;
      showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Liked`);
      clearSelected();
      handleMarkAsSentSuccess();
    } catch {
      showNotification('error', 'Bulk update failed');
    }
  };

  const returnToPending = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Return ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending? Their send records will be removed.`)) return;
    await markAsPending();
  };

  // Remove a property from the Liked tab: confirm, DELETE the outreach record,
  // and update the UI without a full page refresh (optimistic removal + rollback on error).
  const removeFromLiked = async (prop: OutreachProperty) => {
    if (activeTab !== 'liked') return;
    if (!window.confirm(`确定取消喜欢 "${prop.property_address}"？\nAre you sure you want to remove this from Liked?`)) {
      return;
    }
    const itemId = prop.id;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
    try {
      const res = await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      showNotification('success', '已从 Liked 移除 / Removed from Liked');
      window.scrollTo(0, 0);
    } catch {
      setItems((prev) => [...prev, prop]);
      setClassicItems((prev) => [...prev, prop]);
      showNotification('error', '取消喜欢失败 / Failed to remove');
    }
  };

  const handleLastSoldPreset = (preset: string) => {
    setLastSoldPreset(preset);
  };

  const startNewCampaign = async () => {
    if (selected.size === 0) return;
    const name = window.prompt('New campaign name (e.g. 2027_Calendar)');
    if (!name) return;
    try {
      const res = await fetch('/api/admin/outreach/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_ids: Array.from(selected), new_campaign: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to copy');
      showNotification('success', `Copied ${data.added || 0} address(es) to ${name}`);
      clearSelected();
      fetchItems();
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Start new campaign failed:', err);
      showNotification('error', 'Failed to start new campaign');
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selected.size} address${selected.size === 1 ? '' : 'es'}? This action cannot be undone.`
    );

    if (!confirmed) return;

    const idsToDelete = new Set(Array.from(selected));
    showNotification('success', `Deleted ${selected.size} address${selected.size === 1 ? '' : 'es'} successfully`);
    clearSelected();
    setItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    setClassicItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    window.scrollTo(0, 0);

    try {
      await Promise.all(
        Array.from(idsToDelete).map((id) =>
          fetch(`/api/admin/outreach/${id}`, {
            method: 'DELETE',
          })
        )
      );
    } catch (err) {
      console.error('Delete failed:', err);
      showNotification('error', 'Some addresses may not have been deleted');
    }
  };

  function extractHouseNumber(address: string): { houseNumber: number; unitNumber: number } {
    const clean = address.trim();
    const unitMatch = clean.match(/^-?(\d+)\/(\d+)/);
    if (unitMatch) {
      return { houseNumber: parseInt(unitMatch[2], 10), unitNumber: parseInt(unitMatch[1], 10) };
    }
    const numMatch = clean.match(/^-?(\d+)/);
    return { houseNumber: numMatch ? parseInt(numMatch[1], 10) : 999999, unitNumber: 0 };
  }

  const currentContentKey = useMemo(() => {
    return displayItems.map((i) => i.id).join(',') + '|' + sortOrder;
  }, [displayItems, sortOrder]);

  const firstPendingSuburb = useMemo(() => {
    const s = displayItems.find((i) => i.suburb)?.suburb;
    return s || '';
  }, [displayItems]);

  // Fetch street clusters when Pending + Unsent + a suburb is known.
  const todayRunSuburb = reportSuburbFilter || firstPendingSuburb;

  const handleTodayRunOrderApplied = useCallback(() => {
    setTodayRunRefreshKey((k) => k + 1);
  }, []);

  const handleResetManualOrder = useCallback(async (suburb: string) => {
    try {
      await fetch(`/api/admin/outreach/street-order?suburb=${encodeURIComponent(suburb)}`, {
        method: 'DELETE',
      });
    } catch {
      // non-fatal; the refresh below re-renders Today's Run
    }
    setTodayRunRefreshKey((k) => k + 1);
  }, []);

  // Merged effect: restore start street from localStorage and fetch street-clusters
  // together in a single effect. This avoids a React setState-batching race where
  // both the old restore effect and the fetch effect fired in the same render cycle
  // (when todayRunSuburb changed): the fetch saw the stale '' value because
  // setTodayRunStartStreet() from the restore effect had not been committed yet.
  // Reading localStorage synchronously inside the same effect that builds the fetch
  useEffect(() => {
    if (!todayRunSuburb) {
      setTodayRunStartStreet('');
      setTodayRunData(null);
      setTodayRunError(null);
      todayRunSuburbQuarterRef.current = '';
      return;
    }

    if (activeTab !== 'pending' || sentStatusFilter !== 'unsent') {
      setTodayRunData(null);
      setTodayRunError(null);
      return;
    }

    // The Today Run auto-select feeds the first run's streets back into
    // runStreetFilter. If the suburb or report quarter changes (e.g. the default
    // report lands after the first fetch), the previously selected streets no
    // longer belong to the new suburb/quarter and would filter the list to zero
    // addresses. Drop them until the new street-cluster data auto-selects.
    const todayRunKey = `${todayRunSuburb}|${activeQuarter || ''}`;
    if (todayRunSuburbQuarterRef.current !== todayRunKey) {
      todayRunSuburbQuarterRef.current = todayRunKey;
      setRunStreetFilter([]);
    }

    const effectiveStartStreet =
      todayRunStartStreet ||
      window.localStorage.getItem(`today_run_start_street:${todayRunSuburb}`) ||
      '';

    if (effectiveStartStreet !== todayRunStartStreet) {
      setTodayRunStartStreet(effectiveStartStreet);
    }

    let cancelled = false;
    setTodayRunLoading(true);
    setTodayRunError(null);
    const params = new URLSearchParams({
      suburb: todayRunSuburb,
      radius: '500',
      budget: String(todayRunBudget),
      status: 'pending',
      sent_status: 'unsent',
      address_coords: 'true',
    });
    if (effectiveStartStreet) {
      params.set('start_street', effectiveStartStreet);
    }
    if (activeQuarter) {
      params.set('report_quarter', activeQuarter);
    }
    fetch(`/api/admin/outreach/street-clusters?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed to load');
        if (
          effectiveStartStreet &&
          Array.isArray(json.allStreets) &&
          !json.allStreets.some((s: { street: string }) => s.street === effectiveStartStreet)
        ) {
          window.localStorage.removeItem(`today_run_start_street:${todayRunSuburb}`);
          setTodayRunStartStreet('');
        }
        setTodayRunData(json);
      })
      .catch((e) => {
        if (!cancelled) setTodayRunError(e.message);
      })
      .finally(() => {
        if (!cancelled) setTodayRunLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, sentStatusFilter, todayRunSuburb, todayRunBudget, todayRunStartStreet, todayRunRefreshKey, activeQuarter]);

  const groupedBySuburb = useMemo(() => {
    const sourceItems = filteredLikedItems ?? displayItems;
    const groups = new Map<string, Map<string, OutreachProperty[]>>();

    sourceItems.forEach((item) => {
      const suburb = item.suburb || 'Unknown';
      const street = item.street || extractStreetFromLikedItem(item);

      if (!groups.has(suburb)) {
        groups.set(suburb, new Map());
      }
      const streetMap = groups.get(suburb)!;

      if (!streetMap.has(street)) {
        streetMap.set(street, []);
      }
      streetMap.get(street)!.push(item);
    });

    // Cluster order map: street name -> sort index, from the street-clusters
    // API for the active suburb. Streets not in the cluster list sort last.
    const clusterOrder = new Map<string, number>();
    if (todayRunData && todayRunData.suburb) {
      todayRunData.groups.forEach((g) => {
        g.streets.forEach((s) => {
          if (!clusterOrder.has(s.street)) {
            clusterOrder.set(s.street, clusterOrder.size);
          }
        });
      });
    }

    return Array.from(groups.entries())
      .map(([suburb, streetMap]) => {
        const streets = Array.from(streetMap.entries())
          .map(([street, properties]) => ({
            street,
            properties: properties.sort((a, b) => {
              const houseA = extractHouseNumber(a.property_address);
              const houseB = extractHouseNumber(b.property_address);

              if (houseA.houseNumber !== houseB.houseNumber) {
                return houseA.houseNumber - houseB.houseNumber;
              }
              if (houseA.unitNumber !== houseB.unitNumber) {
                return houseA.unitNumber - houseB.unitNumber;
              }

              const dateCompare = sortOrder === 'asc'
                ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

              return dateCompare;
            }),
            totalCount: properties.length,
          }))
          .sort((a, b) => {
            const ia = clusterOrder.get(a.street);
            const ib = clusterOrder.get(b.street);
            if (ia !== undefined && ib !== undefined) return ia - ib;
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            return a.street.localeCompare(b.street, undefined, { sensitivity: 'base' });
          });

        return {
          suburb,
          streets,
          totalCount: streets.reduce((sum, s) => sum + s.totalCount, 0),
        };
      })
      .sort((a, b) => a.suburb.localeCompare(b.suburb, undefined, { sensitivity: 'base' }));
  }, [currentContentKey, todayRunData, filteredLikedItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Card view mirrors the list view's ordering: streets follow the Today's Run
  // cluster order (from street-clusters), then house number within a street.
  const cardOrderedItems = useMemo(() => {
    const items = [...(filteredLikedItems ?? displayItems)];
    const clusterOrder = new Map<string, number>();
    if (todayRunData && todayRunData.suburb) {
      todayRunData.groups.forEach((g) => {
        g.streets.forEach((s) => {
          if (!clusterOrder.has(s.street)) {
            clusterOrder.set(s.street, clusterOrder.size);
          }
        });
      });
    }
    items.sort((a, b) => {
      const suburbA = a.suburb || 'Unknown';
      const suburbB = b.suburb || 'Unknown';
      const suburbCmp = suburbA.localeCompare(suburbB, undefined, { sensitivity: 'base' });
      if (suburbCmp !== 0) return suburbCmp;

      const streetA = a.street || extractStreetFromLikedItem(a);
      const streetB = b.street || extractStreetFromLikedItem(b);
      const ia = clusterOrder.get(streetA);
      const ib = clusterOrder.get(streetB);
      if (ia !== undefined && ib !== undefined) {
        if (ia !== ib) return ia - ib;
      } else if (ia !== undefined) {
        return -1;
      } else if (ib !== undefined) {
        return 1;
      }
      if (streetA !== streetB) {
        return streetA.localeCompare(streetB, undefined, { sensitivity: 'base' });
      }

      const houseA = extractHouseNumber(a.property_address);
      const houseB = extractHouseNumber(b.property_address);
      if (houseA.houseNumber !== houseB.houseNumber) return houseA.houseNumber - houseB.houseNumber;
      if (houseA.unitNumber !== houseB.unitNumber) return houseA.unitNumber - houseB.unitNumber;
      return sortOrder === 'asc'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return items;
  }, [displayItems, filteredLikedItems, todayRunData, sortOrder]);

  // Restore classic items from the shared per-page cache when switching to
  // classic mode. This avoids a loading flash when the data was already
  // fetched under infinite scroll (same cache key). Runs in an effect to
  // avoid calling setState during render, which causes a "Too many re-renders"
  // loop when the cached page is empty.
  useEffect(() => {
    if (!isClassic || classicItems.length > 0) return;
    const key = buildCacheKey(currentPage);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setClassicItems(cached.items);
      setClassicPagination(cached.pagination);
      setClassicLoading(false);
    }
  }, [isClassic, classicItems.length, currentPage, buildCacheKey]);

  if (status === 'loading') return <SkeletonOutreach />;

  return (
    <div style={{
      maxWidth: "1400px",
      margin: "0 auto",
      padding: "8px",
      "--input-border": "#e2e8f0",
      "--input-bg": "#ffffff",
      "--foreground": "#171717",
      "--card-bg": "#ffffff",
      "--card-border": "#e2e8f0",
      "--text-heading": "#2D3748",
      "--text-muted": "#718096",
      "--background": "#f8fafc",
    } as React.CSSProperties}>
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
        >
          {notification.msg}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">📬 Outreach</h1>
        <p className="text-gray-600 mt-1">Direct Mail Campaign Management</p>
      </div>

      {/* Filters */}
      <div style={{
        marginBottom: "32px",
        padding: "32px",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#2D3748" }}>
            Search Filters
          </h2>
        </div>

        {/* Status Filter Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Status
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(['liked', 'pending', 'sent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); setReportSuburbFilter('');  setSentStatusFilter('all'); setSortMode(tab === 'sent' ? 'time' : 'address'); setSortOrder('asc'); setSentDateFilter(tab === 'sent' ? [todayDateKey()] : []); setRunStreetFilter([]); setStreetFilter(''); if (tab !== 'liked') { setLikedStreetModeApplied(false); setLikedSelectedStreet(''); setLikedStreetSearch(''); setLikedStartStreet(''); setLikedApiStreets([]); setLikedOrderedStreets([]); } }}
                style={{
                  padding: '8px 18px',
                  backgroundColor: activeTab === tab ? (tab === 'liked' ? '#ec4899' : tab === 'pending' ? '#3b82f6' : '#8b5cf6') : 'white',
                  color: activeTab === tab ? 'white' : '#4a5568',
                  border: activeTab === tab ? `2px solid ${tab === 'liked' ? '#ec4899' : tab === 'pending' ? '#3b82f6' : '#8b5cf6'}` : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: activeTab === tab ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === tab ? `0 4px 12px ${tab === 'liked' ? 'rgba(236, 72, 153, 0.3)' : tab === 'pending' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(139, 92, 246, 0.3)'}` : 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {tab === 'liked' ? '❤️ Liked' : tab === 'pending' ? '⏳ Pending' : '✓ Sent'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'pending' && (
          <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#f8faff", borderRadius: "12px", border: "1px solid #dbeafe" }}>
            <ReportFilterSection
              availableReports={availableReports}
              setAvailableReports={setAvailableReports}
              reportSuburbFilter={reportSuburbFilter}
              setReportSuburbFilter={setReportSuburbFilter}
              
              
              activeQuarter={activeQuarter}
              setActiveQuarter={setActiveQuarter}
              sentStatusFilter={sentStatusFilter}
              setSentStatusFilter={setSentStatusFilter}
              setSuburbFilter={setSuburbFilter}
              setLastSoldPreset={setLastSoldPreset}
              onClearRunFilter={() => {
                setRunStreetFilter([]);
                setStreetFilter('');
              }}
            />
          </div>
        )}

        {activeTab === 'pending' && sentStatusFilter === 'unsent' && (
          <TodayRunSection
            isMobile={isMobile}
            status={sentStatusFilter}
            data={todayRunData}
            loading={todayRunLoading}
            error={todayRunError}
            budget={todayRunBudget}
            onBudgetChange={setTodayRunBudget}
            onSelectRun={(suburb, streets) => {
              setReportSuburbFilter(suburb);
              setRunStreetFilter(streets);
              setStreetFilter('');
            }}
            onSelectStreet={(suburb, street) => {
              setReportSuburbFilter(suburb);
              setRunStreetFilter([]);
              setStreetFilter(street);
            }}
            reportQuarter={activeQuarter || undefined}
            onOrderApplied={handleTodayRunOrderApplied}
            onResetManualOrder={handleResetManualOrder}
            startStreet={todayRunStartStreet}
            onStartStreetChange={(suburb, street) => {
              window.localStorage.setItem(`today_run_start_street:${suburb}`, street);
              setTodayRunStartStreet(street);
            }}
          />
        )}

        {activeTab === 'sent' && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
              📅 Filter by Quarter
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => { setActiveQuarter(''); }}
                style={{
                  padding: '7px 14px',
                  backgroundColor: activeQuarter === '' ? '#8b5cf6' : 'white',
                  color: activeQuarter === '' ? 'white' : '#4a5568',
                  border: activeQuarter === '' ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                  fontWeight: activeQuarter === '' ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                All
              </button>
              {sentQuarterOptions.map(label => (
                <button
                  key={label}
                  onClick={() => { setActiveQuarter(label); }}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: activeQuarter === label ? '#8b5cf6' : 'white',
                    color: activeQuarter === label ? 'white' : '#4a5568',
                    border: activeQuarter === label ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                    borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: activeQuarter === label ? '600' : '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {label}{activeQuarter === label ? ' ●' : ' ○'}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sent' && (
          <div style={{ marginBottom: "20px", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#4a5568" }}>Sort:</span>
            {([
              { value: 'time' as const, label: 'By Time' },
              { value: 'address' as const, label: 'By Street' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortMode(opt.value)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: sortMode === opt.value ? '#8b5cf6' : 'white',
                  color: sortMode === opt.value ? 'white' : '#4a5568',
                  border: sortMode === opt.value ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: sortMode === opt.value ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'sent' && (
          <div style={{ marginBottom: "20px" }}>
            <SentDateFilter dates={sentDateFilter} onChange={setSentDateFilter} />
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
            Search by Address
          </label>
          <AddressAutocomplete
            value={addressInput}
            city={''}
            useGoogleMaps={true}
            onChange={(val) => {
              setAddressInput(val);
            }}
            onSelect={(suggestion) => {
              setAddressInput(suggestion.address);
              if (suggestion.suburb) {
                setSuburbFilter(suggestion.suburb);
              }
            }}
            placeholder="🔍 Search by address..."
          />
        </div>

        {/* Quick Suburb Filter Buttons */}
        {sentStatusFilter === 'all' && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "10px" }}>
              Quick Filter by Suburb
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              {SUBURB_PRIORITY_ORDER.filter((s) => !likedStreetModeApplied || suburbFilter === s || reportSuburbFilter === s).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (suburbFilter === s) return;
                    setAddressInput('');
                    setSuburbFilter(s);
                  }}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: suburbFilter === s ? '#3b82f6' : 'white',
                    color: suburbFilter === s ? 'white' : '#4a5568',
                    border: suburbFilter === s ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: suburbFilter === s ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: suburbFilter === s ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (suburbFilter !== s) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (suburbFilter !== s) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'liked' && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: likedStreetModeApplied ? '12px' : '0' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#4a5568' }}>🗺️ Filter by Street</span>
              <button
                onClick={() => {
                  const next = !likedStreetModeApplied;
                  if (next) {
                    const effectiveSub = reportSuburbFilter || suburbFilter;
                    if (!effectiveSub) {
                      showNotification('error', 'Please select a suburb first before applying street filter.');
                      return;
                    }
                    // Derive initial selected street from already-loaded items.
                    // NOTE: do NOT mutate propertyFilter / lastSoldPreset here —
                    // those changes trigger the debounce re-fetch which clears
                    // displayItems before likedStreetsSummary can be read.
                    const summary = aggregateLikedStreets(displayItems, '');
                    const firstStreet = summary[0]?.street || '';
                    setLikedSelectedStreet(firstStreet);
                    setLikedStreetSearch('');
                    setLikedStreetsVisible(5);
                    // Load all liked streets for this suburb from the API
                    // so the Start street dropdown always shows the full list
                    // (not limited to what's currently paginated client-side).
                    fetchLikedStreets(effectiveSub);
                    let storedStart = '';
                    try { storedStart = window.localStorage.getItem(`liked_start_street:${effectiveSub}`) || ''; } catch { /* ignore */ }
                    setLikedStartStreet(storedStart);
                    if (storedStart) {
                      setLikedSelectedStreet(storedStart);
                      // Also fetch nearby streets for the stored start street
                      fetchLikedOrderedStreets(effectiveSub, storedStart);
                    }
                  } else {
                    setLikedSelectedStreet('');
                    setLikedStreetSearch('');
                    setStreetFilter('');
                    setLikedStreetsVisible(5);
                    setLikedStartStreet('');
                    setLikedApiStreets([]);
                    setLikedOrderedStreets([]);
                  }
                  setLikedStreetModeApplied(next);
                }}
                style={{
                  padding: '6px 16px',
                  backgroundColor: likedStreetModeApplied ? '#ec4899' : 'white',
                  color: likedStreetModeApplied ? 'white' : '#4a5568',
                  border: likedStreetModeApplied ? '2px solid #ec4899' : '2px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!likedStreetModeApplied) {
                    e.currentTarget.style.backgroundColor = '#fdf2f8';
                    e.currentTarget.style.borderColor = '#f9a8d4';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!likedStreetModeApplied) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {likedStreetModeApplied ? '✔ By Street (click to cancel)' : 'Apply'}
              </button>
              {likedStreetModeApplied && likedSelectedStreet && (
                <span style={{ fontSize: '0.8rem', color: '#ec4899', fontWeight: '600' }}>
                  → {likedSelectedStreet}
                </span>
              )}
            </div>

            {likedStreetModeApplied && (
              <div style={{
                border: '1px solid #fce7f3',
                borderRadius: '12px',
                backgroundColor: '#fdf2f8',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#be185d' }}>
                    Streets in Liked ({(likedApiStreets.length > 0 ? likedApiStreets.length : likedStreetsSummary.length)} street{(likedApiStreets.length > 0 ? likedApiStreets.length : likedStreetsSummary.length) !== 1 ? 's' : ''} · {displayItems.length} address{displayItems.length !== 1 ? 'es' : ''})
                  </span>
                  {likedSelectedStreet && (
                    <button
                      onClick={() => {
                        setLikedSelectedStreet('');
                        setStreetFilter('');
                        setLikedStartStreet('');
                      }}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                      }}
                    >
                      × Clear Filter
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#be185d', fontWeight: '600', marginBottom: '6px' }}>
                    Start street {likedApiLoading && <span style={{ fontWeight: 400, color: '#f9a8d4' }}>loading…</span>}
                  </label>
                  <select
                    aria-label="Start street"
                    value={likedStartStreet}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLikedStartStreet(v);
                      setLikedSelectedStreet(v);
                      setLikedStreetsVisible(5);
                      const sub = reportSuburbFilter || suburbFilter;
                      if (sub) {
                        try { window.localStorage.setItem(`liked_start_street:${sub}`, v); } catch { /* ignore */ }
                        // Fetch nearby streets for the newly chosen start street
                        fetchLikedOrderedStreets(sub, v);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      border: '1px solid #f9a8d4',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      backgroundColor: 'white',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  >
                    <option value="">Auto (default)</option>
                    {/* Use API-fetched full list; fall back to client-derived list while loading */}
                    {(likedApiStreets.length > 0 ? likedApiStreets : likedStreetsSummary).map(({ street, count }) => (
                      <option key={street} value={street}>{street} ({count})</option>
                    ))}
                  </select>
                </div>

                {likedStreetsSummary.length > 8 && (
                  <input
                    type="text"
                    value={likedStreetSearch}
                    onChange={(e) => { setLikedStreetSearch(e.target.value); setLikedStreetsVisible(5); }}
                    placeholder="Search streets..."
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      border: '1px solid #f9a8d4',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      marginBottom: '8px',
                      outline: 'none',
                      backgroundColor: 'white',
                      boxSizing: 'border-box',
                    }}
                  />
                )}

                {/* Nearby streets: 5 closest to the Start street, shown AFTER the start street row */}

                {likedStreetsSummary.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                    No streets found
                  </div>
                ) : (
                  <>
                    {/* Main street list: show 5 at a time, expandable with More Streets.
                        Order: start street first (pinned), then the rest in greedy
                        nearest-neighbour order (API likedOrderedStreets).
                        Falls back to alphabetical likedStreetsOrdered when no API order
                        is available yet (e.g. no start street chosen). */}
                    {(() => {
                      // Build the display list
                      const startEntry = likedStartStreet
                        ? {
                          street: likedStartStreet,
                          count:
                            likedStreetsSummary.find((s) => s.street === likedStartStreet)?.count ??
                            likedApiStreets.find((s) => s.street === likedStartStreet)?.count ??
                            0,
                          distance_m: -1,
                        }
                        : null;

                      // After the pinned start-street row, use the API-ordered list when
                      // available, otherwise fall back to the client wrapping order.
                      const restList: Array<{ street: string; count: number; distance_m?: number }> =
                        likedStartStreet && likedOrderedStreets.length > 0
                          ? likedOrderedStreets
                          : likedStreetsOrdered.filter((s) => s.street !== likedStartStreet);

                      // Total visible slots: 1 (start) + restList
                      const totalCount = restList.length + (startEntry ? 1 : 0);

                      return (
                        <>
                          {/* Row 0: the pinned start-street */}
                          {startEntry && (
                            <button
                              key={startEntry.street}
                              onClick={() => {
                                const nextStreet = likedSelectedStreet === startEntry.street ? '' : startEntry.street;
                                setLikedSelectedStreet(nextStreet);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 14px',
                                marginBottom: '6px',
                                backgroundColor: likedSelectedStreet === startEntry.street ? '#ec4899' : 'white',
                                color: likedSelectedStreet === startEntry.street ? 'white' : '#374151',
                                border: likedSelectedStreet === startEntry.street ? '1px solid #ec4899' : '1px solid #fce7f3',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: likedSelectedStreet === startEntry.street ? '600' : '400',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                width: '100%',
                              }}
                              onMouseEnter={(e) => {
                                if (likedSelectedStreet !== startEntry.street) {
                                  e.currentTarget.style.backgroundColor = '#fdf2f8';
                                  e.currentTarget.style.borderColor = '#f9a8d4';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (likedSelectedStreet !== startEntry.street) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.borderColor = '#fce7f3';
                                }
                              }}
                            >
                              <span>{startEntry.street}</span>
                              <span style={{
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                backgroundColor: likedSelectedStreet === startEntry.street ? 'rgba(255,255,255,0.25)' : '#fce7f3',
                                color: likedSelectedStreet === startEntry.street ? 'white' : '#be185d',
                                padding: '2px 8px',
                                borderRadius: '999px',
                              }}>
                                {startEntry.count}
                              </span>
                            </button>
                          )}

                          {/* Rows 1+: greedy-ordered rest streets (up to likedStreetsVisible - 1 slots) */}
                          {restList.slice(0, Math.max(0, likedStreetsVisible - (startEntry ? 1 : 0))).map(({ street, count }) => (
                            <button
                              key={street}
                              onClick={() => {
                                const nextStreet = likedSelectedStreet === street ? '' : street;
                                setLikedSelectedStreet(nextStreet);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 14px',
                                marginBottom: '6px',
                                backgroundColor: likedSelectedStreet === street ? '#ec4899' : 'white',
                                color: likedSelectedStreet === street ? 'white' : '#374151',
                                border: likedSelectedStreet === street ? '1px solid #ec4899' : '1px solid #fce7f3',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: likedSelectedStreet === street ? '600' : '400',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                width: '100%',
                              }}
                              onMouseEnter={(e) => {
                                if (likedSelectedStreet !== street) {
                                  e.currentTarget.style.backgroundColor = '#fdf2f8';
                                  e.currentTarget.style.borderColor = '#f9a8d4';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (likedSelectedStreet !== street) {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.borderColor = '#fce7f3';
                                }
                              }}
                            >
                              <span>{street}</span>
                              <span style={{
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                backgroundColor: likedSelectedStreet === street ? 'rgba(255,255,255,0.25)' : '#fce7f3',
                                color: likedSelectedStreet === street ? 'white' : '#be185d',
                                padding: '2px 8px',
                                borderRadius: '999px',
                              }}>
                                {count}
                              </span>
                            </button>
                          ))}

                          {totalCount > likedStreetsVisible && (
                            <button
                              onClick={() => setLikedStreetsVisible((v) => v + 5)}
                              style={{
                                width: '100%',
                                padding: '8px 14px',
                                backgroundColor: '#fce7f3',
                                color: '#be185d',
                                border: '1px solid #f9a8d4',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                transition: 'all 0.15s ease',
                                marginTop: '2px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#ec4899';
                                e.currentTarget.style.color = 'white';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fce7f3';
                                e.currentTarget.style.color = '#be185d';
                              }}
                            >
                              ↧ More Streets ({totalCount - likedStreetsVisible} more)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as 'asc' | 'desc'); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">📅 Time: Oldest First</option>
            <option value="desc">📅 Time: Newest First</option>
          </select>

          <select
            value={streetFilter}
            onChange={(e) => {
              const val = e.target.value;
              setStreetFilter(val);
              if (activeTab === 'liked') {
                setLikedSelectedStreet(val);
              }
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={availableStreets.length === 0}
          >
            <option value="">All Streets</option>
            {availableStreets.map((street) => (
              <option key={street} value={street}>{street}</option>
            ))}
          </select>
        </div>

        {/* Property Type & Market Status */}
        {(!isMobile || !(reportSuburbFilter || activeQuarter)) && (
          <div style={{ marginTop: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
                Property Type
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(['house', 'all', 'townhouse'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPropertyFilter(type)}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: propertyFilter === type ? '#3b82f6' : 'white',
                      color: propertyFilter === type ? 'white' : '#4a5568',
                      border: propertyFilter === type ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: propertyFilter === type ? '600' : '500',
                      transition: 'all 0.2s ease',
                      boxShadow: propertyFilter === type ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (propertyFilter !== type) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (propertyFilter !== type) {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    {type === 'house' ? 'House' : type === 'all' ? 'All' : 'Townhouse/Unit'}
                  </button>
                ))}
                <button
                  onClick={() => setJunkFilter(junkFilter === 'no_junk' ? 'all' : 'no_junk')}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: junkFilter === 'no_junk' ? '#ef4444' : 'white',
                    color: junkFilter === 'no_junk' ? 'white' : '#4a5568',
                    border: junkFilter === 'no_junk' ? '2px solid #ef4444' : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: junkFilter === 'no_junk' ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: junkFilter === 'no_junk' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (junkFilter !== 'no_junk') {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                      e.currentTarget.style.borderColor = '#fca5a5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (junkFilter !== 'no_junk') {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                  title="Filter addresses with No Junk Mail"
                >
                  No Junk
                </button>
                <button
                  onClick={() => setJunkFilter(junkFilter === 'allow_junk' ? 'all' : 'allow_junk')}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: junkFilter === 'allow_junk' ? '#22c55e' : 'white',
                    color: junkFilter === 'allow_junk' ? 'white' : '#4a5568',
                    border: junkFilter === 'allow_junk' ? '2px solid #22c55e' : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: junkFilter === 'allow_junk' ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: junkFilter === 'allow_junk' ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (junkFilter !== 'allow_junk') {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#86efac';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (junkFilter !== 'allow_junk') {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                  title="Filter addresses without No Junk Mail"
                >
                  Allow Junk
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
                Market Status
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(['all', 'for_sale', 'for_rent', 'rented', 'never_rented', 'not_listed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setMarketStatus(status)}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: marketStatus === status ? (status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'rented' ? '#f59e0b' : status === 'never_rented' ? '#0891b2' : status === 'not_listed' ? '#64748b' : '#3b82f6') : 'white',
                      color: marketStatus === status ? 'white' : '#4a5568',
                      border: marketStatus === status ? `2px solid ${status === 'for_sale' ? '#22c55e' : status === 'for_rent' ? '#8b5cf6' : status === 'rented' ? '#f59e0b' : status === 'never_rented' ? '#0891b2' : status === 'not_listed' ? '#64748b' : '#3b82f6'}` : '2px solid #e2e8f0',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: marketStatus === status ? '600' : '500',
                      transition: 'all 0.2s ease',
                      boxShadow: marketStatus === status ? `0 4px 12px ${status === 'for_sale' ? 'rgba(34, 197, 94, 0.3)' : status === 'for_rent' ? 'rgba(139, 92, 246, 0.3)' : status === 'rented' ? 'rgba(245, 158, 11, 0.3)' : status === 'never_rented' ? 'rgba(8, 145, 178, 0.3)' : status === 'not_listed' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (marketStatus !== status) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (marketStatus !== status) {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    {status === 'all' ? 'All' : status === 'for_sale' ? 'For Sale' : status === 'for_rent' ? 'To Rent' : status === 'rented' ? 'Rented' : status === 'never_rented' ? 'Never Rented' : 'Not Listed'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Last Sold */}
        {(!isMobile || !(reportSuburbFilter || activeQuarter)) && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
              Last Sold
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {(['all', '5-15', '5-10', '3-5', '0-3', '10-15', '15+', 'none'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleLastSoldPreset(preset)}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: lastSoldPreset === preset ? (preset === '5-15' || preset === '5-10' ? '#f59e0b' : '#3b82f6') : 'white',
                    color: lastSoldPreset === preset ? 'white' : '#4a5568',
                    border: lastSoldPreset === preset ? (preset === '5-15' || preset === '5-10' ? '2px solid #f59e0b' : '2px solid #3b82f6') : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: lastSoldPreset === preset ? '600' : '500',
                    transition: 'all 0.2s ease',
                    boxShadow: lastSoldPreset === preset ? (preset === '5-15' || preset === '5-10' ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.3)') : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (lastSoldPreset !== preset) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (lastSoldPreset !== preset) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }
                  }}
                >
                  {preset === 'all' ? 'All' : preset === '5-15' ? '★ 5-15 years' : preset === '5-10' ? '5-10 years' : preset === '3-5' ? '3-5 years' : preset === '0-3' ? '0-3 years' : preset === '10-15' ? '10-15 years' : preset === '15+' ? '15+ years' : 'No Last Sold'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Junk Mail filter — always available on mobile, even when a report filter is active */}
        {isMobile && (reportSuburbFilter || activeQuarter) && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
              No Junk Mail
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setJunkFilter(junkFilter === 'no_junk' ? 'all' : 'no_junk')}
                style={{
                  padding: '8px 18px',
                  backgroundColor: junkFilter === 'no_junk' ? '#ef4444' : 'white',
                  color: junkFilter === 'no_junk' ? 'white' : '#4a5568',
                  border: junkFilter === 'no_junk' ? '2px solid #ef4444' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: junkFilter === 'no_junk' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                title="Filter addresses with No Junk Mail"
              >
                🚫 No Junk
              </button>
              <button
                onClick={() => setJunkFilter(junkFilter === 'allow_junk' ? 'all' : 'allow_junk')}
                style={{
                  padding: '8px 18px',
                  backgroundColor: junkFilter === 'allow_junk' ? '#22c55e' : 'white',
                  color: junkFilter === 'allow_junk' ? 'white' : '#4a5568',
                  border: junkFilter === 'allow_junk' ? '2px solid #22c55e' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: junkFilter === 'allow_junk' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                title="Filter addresses without No Junk Mail"
              >
                ✅ Allow Junk
              </button>
              <button
                onClick={() => setJunkFilter('all')}
                style={{
                  padding: '8px 18px',
                  backgroundColor: junkFilter === 'all' ? '#3b82f6' : 'white',
                  color: junkFilter === 'all' ? 'white' : '#4a5568',
                  border: junkFilter === 'all' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: junkFilter === 'all' ? '600' : '500',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                title="Show all addresses"
              >
                All
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {isMobile && (reportSuburbFilter || activeQuarter) && addressInput && (
            <button
              onClick={() => setAddressInput('')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
            >
              ✕ Clear Address
            </button>
          )}
          <button
            onClick={() => {
              setAddressInput('');
              setSuburbFilter('Northcross');
              setStreetFilter('');
              setCampaignFilter('');
              setSortOrder('asc');
              setLastSoldPreset('all');
              setPropertyFilter('all');
              setMarketStatus('all');
              setActiveTab('liked');
              setReportSuburbFilter('');
              
              setSentStatusFilter('all');
              setSortMode('address');
              setRunStreetFilter([]);
              setStreetFilter('');
              setLikedStreetModeApplied(false);
              setLikedSelectedStreet('');
              setLikedStreetSearch('');
              setLikedStreetsVisible(5);
              setLikedStartStreet('');
              setLikedApiStreets([]);
              setLikedOrderedStreets([]);
            }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            ✕ Clear All
          </button>
        </div>
      </div>

      {(activeTab !== 'pending' || viewMode !== 'map') && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", marginBottom: "12px", padding: "12px 16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: "0.9rem", color: "#4a5568" }}>
          {isClassic && !(likedStreetModeApplied && likedSelectedStreet)
            ? `Displaying ${Math.max(1, (currentPage - 1) * pageSize + 1)} to ${Math.min(currentPage * pageSize, stableDisplayTotal)} of ${stableDisplayTotal} properties`
            : `Displaying 1 to ${likedStreetDisplayCount} of ${likedStreetTotalCount} properties`}
        </span>
        <div style={{ display: "inline-flex", borderRadius: "10px", overflow: "hidden", border: "2px solid #e2e8f0" }}>
          <button
            onClick={() => setPaginationMode('infinite')}
            style={{
              padding: "8px 18px",
              backgroundColor: !isClassic ? '#3b82f6' : 'white',
              color: !isClassic ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Infinite Scroll
          </button>
          <button
            onClick={() => setPaginationMode('classic')}
            style={{
              padding: "8px 18px",
              backgroundColor: isClassic ? '#3b82f6' : 'white',
              color: isClassic ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Classic Pages
          </button>
        </div>
      </div>
      )}
      <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: "12px" }}>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'card' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            title="Card View"
          >
            ⊞ Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            title="List View"
          >
            ☰ List
          </button>
          {activeTab === 'pending' && (
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Map View"
            >
              🗺 Map
            </button>
          )}
        </div>
      </div>

      {/* Mobile: overlay status buttons (All / Unsent / Sent / Junk) placed above the map and under the view buttons */}
      {isMobile && viewMode === 'map' && (
        <div style={{ position: 'absolute', left: 12, top: 72, zIndex: 70, display: 'flex', gap: 8 }}>
          {(['all', 'unsent', 'sent', 'junk'] as const).map((s) => {
            const labels: Record<string, string> = { all: 'All', unsent: 'Unsent', sent: 'Sent', junk: 'Junk' };
            const isActive = mapStatusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setMapStatusFilter(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: isActive ? '1.5px solid #2563eb' : '1px solid #d1d5db',
                  background: isActive ? '#eff6ff' : '#ffffff',
                  color: isActive ? '#1d4ed8' : '#374151',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      )}

      {isClassic && (activeTab !== 'pending' || viewMode !== 'map') && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >‹</button>
          <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#4a5568", whiteSpace: "nowrap" }}>
            Page{' '}
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= totalPages) {
                  setCurrentPage(v);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(v) && v >= 1 && v <= totalPages) {
                    setCurrentPage(v);
                  }
                }
              }}
              style={{ width: "52px", padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#2D3748", textAlign: "center", outline: "none", MozAppearance: "textfield" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≫</button>
        </div>
      )}

      {/* Bulk Actions */}
      {activeTab === 'liked' && selected.size > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span className="text-sm font-medium text-pink-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={markAsPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <span aria-hidden="true">⇨</span>
            <span className="ml-1">Mark as Pending</span>
          </button>
          <button
            onClick={deleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            🗑️ Delete
          </button>
          <button
            onClick={clearSelected}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'pending' && selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span className="text-sm font-medium text-blue-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={markAsSent}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <span aria-hidden="true">✓</span>
            <span className="ml-1">Mark as Sent</span>
          </button>
          <button
            onClick={returnToPending}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
          >
            <span aria-hidden="true">⇦</span>
            <span className="ml-1">Return to Pending</span>
          </button>
          <button
            onClick={markAsLiked}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            <span aria-hidden="true">↩</span>
            <span className="ml-1">Return to Liked</span>
          </button>
          <button
            onClick={deleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            🗑️ Delete
          </button>
          <button
            onClick={clearSelected}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear Selection
          </button>
        </div>
      )}

      {activeTab === 'sent' && selected.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span className="text-sm font-medium text-purple-800">
            {selected.size} address{selected.size === 1 ? '' : 'es'} selected
          </span>
          <button
            onClick={async () => {
              if (selected.size === 0) return;
              if (!window.confirm(`Return ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending? Their send records will be removed.`)) return;
              try {
                const results = await Promise.all(
                  Array.from(selected).map(async (id) => {
                    const response = await fetch(`/api/admin/outreach/${id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'pending' }),
                    });
                    const data = await response.json().catch(() => null);
                    if (!response.ok) throw new Error(data?.error || 'Failed');
                    return data.data as OutreachProperty;
                  })
                );
                if (results.length === 0) return;
                showNotification('success', `Moved ${selected.size} address${selected.size === 1 ? '' : 'es'} to Pending`);
                clearSelected();
                handleMarkAsSentSuccess();
              } catch {
                showNotification('error', 'Bulk update failed');
              }
            }}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            <span aria-hidden="true">⇨</span>
            <span className="ml-1">Return to Pending</span>
          </button>
          <button
            onClick={startNewCampaign}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            ⟳ Start New Campaign
          </button>
          <button
            onClick={clearSelected}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Content */}

      {(loading || (isClassic && classicLoading)) ? (
        <SkeletonOutreach />
      ) : displayItems.length === 0 && !loadingMore ? (
        <div className="p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Properties Yet</h3>
          <p className="text-gray-500">
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
            gap: "20px",
          }}>
            {cardOrderedItems.map((prop) => (
              <div
                key={prop.id}
                style={{
                  border: selected.has(prop.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  boxShadow: selected.has(prop.id) ? '0 4px 12px rgba(59,130,246,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <a href={prop.pv_url || prop.property_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative', height: '220px', backgroundColor: '#f8fafc' }}>
                    {prop.image_url && !prop.image_url.includes('no-photo-available') && !imageErrors.has(prop.id) ? (
                      <Image
                        src={getFixedImageUrl(prop.image_url) || prop.image_url}
                        alt={prop.property_address}
                        width={400}
                        height={220}
                        unoptimized
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => handleImageError(prop.id)}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        color: '#4a5568',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                      }}>
                        <div style={{
                          backgroundColor: '#e2e8f0',
                          width: '80%',
                          height: '70%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          border: '2px dashed #94a3b8',
                        }}>
                          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>
                            No Image Available
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Top-left badges */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 2 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(prop.id)}
                        onChange={() => toggleSelect(prop.id)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: '#3b82f6',
                        }}
                      />
                      {prop.build_year && (
                        <div style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.9)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}>
                          Built {prop.build_year}
                        </div>
                      )}
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      backgroundColor: 'rgba(34, 197, 94, 0.9)',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      {prop.suburb}
                    </div>
                    {/* For Sale Badge */}
                    {prop.on_market_sale && (
                      <div style={{
                        position: 'absolute',
                        top: '52px',
                        left: '16px',
                        backgroundColor: 'rgba(34, 197, 94, 0.9)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        For Sale{prop.sale_price ? ` ${prop.sale_price}` : ''}
                      </div>
                    )}
                    {/* For Rent Badge */}
                    {prop.on_market_rent && (
                      <div style={{
                        position: 'absolute',
                        top: prop.on_market_sale ? '88px' : '52px',
                        left: '16px',
                        backgroundColor: 'rgba(139, 92, 246, 0.9)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        To Rent{prop.rent_price ? ` ${prop.rent_price}` : ''}
                      </div>
                    )}
                    {/* Rented Badge */}
                    {prop.has_rental_history && (
                      <div style={{
                        position: 'absolute',
                        top: (() => {
                          let count = 0;
                          if (prop.on_market_sale) count++;
                          if (prop.on_market_rent) count++;
                          return `${52 + count * 36}px`;
                        })(),
                        left: '16px',
                        backgroundColor: 'rgba(245, 158, 11, 0.9)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        Rented
                      </div>
                    )}
                    {/* Top-right badges: Status badge, No Junk Mail toggle, Unlike button */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 2 }}>
                      {activeTab !== 'liked' && (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            border: '1px solid',
                            whiteSpace: 'nowrap',
                          }}
                          className={`${STATUS_COLORS[prop.status]}`}
                        >
                          {STATUS_LABELS[prop.status] || prop.status}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const pid = prop.joined_property_id;
                          if (!pid) return;
                          const newVal = !prop.no_junk_mail;
                          cacheRef.current.clear();
                          setItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: newVal } : item));
                          setClassicItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: newVal } : item));
                          fetch(`/api/admin/properties/${pid}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ no_junk_mail: newVal }),
                          }).catch(() => {
                            cacheRef.current.clear();
                            setItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: !newVal } : item));
                            setClassicItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: !newVal } : item));
                          });
                        }}
                        style={{
                          width: '36px', height: '36px',
                          borderRadius: '50%',
                          background: prop.no_junk_mail ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.85)',
                          border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          lineHeight: 1,
                          cursor: 'pointer',
                          color: prop.no_junk_mail ? 'white' : '#64748b',
                          transition: 'all 0.2s ease',
                        }}
                        title={prop.no_junk_mail ? 'No Junk - Click to allow' : 'Click to mark No Junk'}
                      >🚫</button>
                      {activeTab === 'liked' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFromLiked(prop);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            color: 'white',
                            zIndex: 2,
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title="取消喜欢 / Unlike"
                        >
                          ♥
                        </button>
                      )}
                    </div>
                    {prop.last_sold_date && (() => {
                      const sold = new Date(prop.last_sold_date!);
                      if (!isNaN(sold.getTime())) {
                        const years = new Date().getFullYear() - sold.getFullYear();
                        if (years > 0) {
                          return (
                            <div style={{
                              position: 'absolute',
                              bottom: '12px',
                              right: '12px',
                              backgroundColor: 'rgba(249, 115, 22, 0.9)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              Sold {years}yr{years > 1 ? 's' : ''} ago
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div></a>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.15rem',
                      fontWeight: '700',
                      color: '#2D3748',
                      lineHeight: '1.3',
                      flex: 1,
                    }}>
                      {prop.property_address}
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", marginLeft: "12px" }}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEditModal(prop);
                        }}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#f0fdf4',
                          color: '#16a34a',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const full = buildPropertyAddress(prop.property_address, prop.suburb, prop.city, prop.region);
                          openGoogleMaps(full || prop.property_address);
                        }}
                        aria-label={`Open ${prop.property_address} in Google Maps`}
                        style={{
                          fontSize: '0.75rem',
                          color: '#2563eb',
                          fontWeight: '600',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                          e.currentTarget.style.borderColor = '#93c5fd';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                          e.currentTarget.style.borderColor = '#bfdbfe';
                        }}
                      >
                        Street
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '12px' }}>
                    {prop.suburb}, {prop.city}
                  </div>

                  {(activeTab === 'pending' || activeTab === 'sent') && prop.latest_send_title &&
                    (!activeQuarter || `${prop.latest_send_year}-${prop.latest_send_quarter}` === activeQuarter) && (
                    <div style={{
                      fontSize: '0.8rem', color: '#7c3aed', marginBottom: '14px',
                      padding: '8px 12px', backgroundColor: '#f5f3ff', borderRadius: '8px',
                      border: '1px solid #ede9fe', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <span>📄</span>
                      <span style={{ fontWeight: '500' }}>{prop.latest_send_title}</span>
                      {prop.latest_sent_at && (
                        <span style={{ color: '#a78bfa', marginLeft: 'auto', fontSize: '0.75rem' }}>
                          {new Date(prop.latest_sent_at).toLocaleDateString('en-NZ')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Price & RV Section */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #e2e8f0',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Last Sold</div>
                      <div style={{ fontWeight: '700', color: '#2D3748', fontSize: '1rem', marginBottom: '2px' }}>
                        {prop.last_sold_date ? new Date(prop.last_sold_date).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                      </div>
                      <div style={{ fontWeight: '600', color: '#4a5568', fontSize: '0.95rem' }}>
                        {prop.last_sold_price != null
                          ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.last_sold_price)
                          : 'N/A'}
                      </div>
                      {prop.last_sold_price != null && prop.capital_value != null && prop.last_sold_price > 0 && prop.capital_value > 0 && (() => {
                        const growth = ((prop.capital_value! - prop.last_sold_price!) / prop.last_sold_price!) * 100;
                        return (
                          <div style={{ marginTop: '4px', fontSize: '0.75rem', color: growth > 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                            <span>{growth > 0 ? '↗' : '↘'}</span>
                            <span> {growth > 0 ? '+' : ''}{growth.toFixed(1)}% since sold</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>RV (Rating Value)</div>
                      <div style={{ fontWeight: '700', color: '#2D3748', fontSize: '1.1rem' }}>
                        {prop.capital_value != null
                          ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.capital_value)
                          : 'N/A'}
                      </div>
                      {prop.build_year && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#718096', fontWeight: '500' }}>
                          Built in {prop.build_year}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    textAlign: 'center',
                    marginTop: 'auto',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                        <FaBed style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                        <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                          {prop.bedrooms !== null ? prop.bedrooms : '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Beds</div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                        <FaBath style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                        <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                          {prop.bathrooms !== null ? prop.bathrooms : '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Baths</div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                        <FaCar style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                        <span style={{ fontWeight: '600', color: '#2D3748', fontSize: '1.1rem' }}>
                          {prop.car_spaces !== null ? prop.car_spaces : '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '500' }}>Cars</div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                        <FaRulerCombined style={{ marginRight: '6px', color: '#718096', fontSize: '1.1rem' }} />
                      </div>
                      <div style={{ fontWeight: '600', color: '#2D3748', fontSize: '0.9rem', lineHeight: '1.3' }}>
                        F: {prop.floor_area && prop.floor_area !== '-' ? prop.floor_area : '-'} m²
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#718096', fontWeight: '500', lineHeight: '1.3' }}>
                        L: {prop.land_area && prop.land_area !== '-' && prop.land_area !== 0 ? prop.land_area : '-'} m²
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px',
                    marginBottom: '12px',
                  }}>
                    {prop.realestate_url && (
                      <a
                        href={prop.realestate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#f0fdf4',
                          color: '#16a34a',
                          textDecoration: 'none',
                          fontWeight: '600',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        RealEstate
                      </a>
                    )}
                    {activeTab === 'liked' && (
                      <button
                        onClick={async () => {
                          if (selected.size > 0) {
                            if (!window.confirm(`Move ${selected.size} selected address${selected.size === 1 ? '' : 'es'} to Pending?`)) return;
                            await markAsPending();
                          } else {
                            if (!window.confirm(`Move "${prop.property_address}" to Pending?`)) return;
                            try {
                              const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'pending' }),
                              });
                              if (!res.ok) throw new Error('Failed');
                              await res.json();
                              showNotification('success', 'Moved to Pending');
                              handleMarkAsSentSuccess();
                            } catch {
                              showNotification('error', 'Failed to move to Pending');
                            }
                          }
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        ⇨ Pending
                      </button>
                    )}
                    {canMarkAsSent && (
                      <button
                        onClick={() => openSendModal([prop.id])}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        <FaPaperPlane style={{ display: 'inline', marginRight: '4px' }} />
                        Send Report
                      </button>
                    )}
                    <button
                      onClick={() => openHistoryDrawer(prop.id, prop.property_address)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      title="View dispatch history"
                    >
                      <FaHistory style={{ display: 'inline', marginRight: '4px' }} />
                      {activeQuarter
                        ? 'History'
                        : prop.total_send_count && prop.total_send_count > 0
                          ? `${prop.total_send_count}x Sent`
                          : 'History'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openConvertModal(prop); }}
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #c4b5fd',
                        backgroundColor: '#f5f3ff',
                        color: '#7c3aed',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      title="Convert to Lead"
                    >
                      ⇨ Lead
                    </button>
                    {activeTab === 'pending' && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Return "${prop.property_address}" to Liked?`)) {
                            try {
                              const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'liked' }),
                              });
                              if (!res.ok) throw new Error('Failed');
                              await res.json();
                              showNotification('success', 'Returned to Liked');
                              handleMarkAsSentSuccess();
                            } catch {
                              showNotification('error', 'Failed to return to Liked');
                            }
                          }
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #fde68a',
                          backgroundColor: '#fffbeb',
                          color: '#d97706',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        ↩ Liked
                      </button>
                    )}
                    {activeTab === 'sent' && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Return "${prop.property_address}" to Pending?`)) return;
                          try {
                            const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'pending' }),
                            });
                            if (!res.ok) throw new Error('Failed');
                            await res.json();
                            showNotification('success', 'Returned to Pending');
                            handleMarkAsSentSuccess();
                          } catch {
                            showNotification('error', 'Failed to return to Pending');
                          }
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #fde68a',
                          backgroundColor: '#fffbeb',
                          color: '#d97706',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        ⇨ Pending
                      </button>
                    )}
                    {(activeTab === 'pending' || activeTab === 'liked' || activeTab === 'sent') && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete "${prop.property_address}"?`)) {
                            const itemId = prop.id;
                            setItems((prev) => prev.filter((item) => item.id !== itemId));
                            setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
                            try {
                                             await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
                                             showNotification('success', 'Address deleted');
                                             window.scrollTo(0, 0);
                              window.scrollTo(0, 0);
                            } catch {
                              showNotification('error', 'Failed to delete');
                            }
                          }
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  {prop.description && (
                    <div style={{
                      color: '#4a5568',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }} title={prop.description}>
                      {prop.description}
                    </div>
                  )}

                  {/* AI Data Chamber */}
                  <div style={{
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    fontSize: '1px',
                    opacity: 0,
                  }}>
                    {[
                      '[AI-DATA-START]',
                      `Address: ${prop.property_address}`,
                      `Suburb: ${prop.suburb}`,
                      prop.city ? `City: ${prop.city}` : null,
                      prop.region ? `Region: ${prop.region}` : null,
                      prop.build_year ? `Year Built: ${prop.build_year}` : null,
                      prop.bedrooms != null ? `Bedrooms: ${prop.bedrooms}` : null,
                      prop.bathrooms != null ? `Bathrooms: ${prop.bathrooms}` : null,
                      prop.car_spaces != null ? `Car Spaces: ${prop.car_spaces}` : null,
                      prop.floor_area ? `Floor Size: ${prop.floor_area}` : null,
                      prop.land_area ? `Land Area: ${prop.land_area}` : null,
                      prop.capital_value != null ? `Capital Value (RV): ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.capital_value)}` : null,
                      prop.last_sold_price != null ? `Last Sold Price: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.last_sold_price)}` : null,
                      prop.last_sold_date ? `Last Sold Date: ${prop.last_sold_date}` : null,
                      prop.property_type ? `Property Type: ${prop.property_type}` : null,
                      prop.status ? `Status: ${prop.status}` : null,
                      (prop.pv_url || prop.property_url) ? `Property URL: ${prop.pv_url || prop.property_url}` : null,
                      prop.description ? `Description: ${prop.description}` : null,
                      prop.realestate_url ? `RealEstate URL: ${prop.realestate_url}` : null,
                      prop.property_history ? `Property History: ${prop.property_history}` : 'Property History: []',
                      prop.has_rental_history != null ? `Has Rental History: ${prop.has_rental_history ? 'Yes' : 'No'}` : null,
                      prop.is_currently_rented != null ? `Currently Rented: ${prop.is_currently_rented ? 'Yes' : 'No'}` : null,
                      prop.estimated_value_low != null && prop.estimated_value_high != null
                        ? `Estimated Value: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.estimated_value_low)} - ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.estimated_value_high)}`
                        : null,
                      prop.suburb_median_price != null ? `Suburb Median Price: ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(prop.suburb_median_price)}` : null,
                      prop.suburb_days_on_market != null ? `Suburb Days On Market: ${prop.suburb_days_on_market}` : null,
                      '[AI-DATA-END]',
                    ].filter(Boolean).join('\n')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : viewMode === 'map' ? (
        /* ── MAP VIEW: sidebar 30% + Google Map 70% ── */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : mapSidebarHidden ? '48px 1fr' : '30% 1fr',
            gap: 12,
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          {/* Desktop: regular sidebar column. Mobile: render a compact, absolute-positioned sidebar (icon-only when hidden). */}
          {!isMobile && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden', minWidth: 0 }}>
              <OutreachMapSidebar
                data={todayRunData}
                loading={todayRunLoading}
                error={todayRunError}
                activeRunId={activeMapRunId}
                collapsedStreets={collapsedStreets}
                onToggleStreet={toggleStreet}
                onStreetSelect={(suburb, street) => {
                  setActiveMapStreet(street);
                  setReportSuburbFilter(suburb);
                }}
                onRunSelect={(runId) => {
                  setActiveMapRunId(runId);
                  setActiveMapStreet(null);
                }}
                hidden={mapSidebarHidden}
                onToggleHidden={() => setMapSidebarHidden((h) => !h)}
                streetStatusMap={mapStreetStatusMap}
                addressCounts={mapAddressCounts}
                statusFilter={mapStatusFilter}
                onStatusFilterChange={setMapStatusFilter}
                onSuburbClick={(suburb) => {
                  setMapStatusFilter('all');
                  setActiveMapStreet(null);
                  setActiveMapRunId(null);
                  setReportSuburbFilter(suburb);
                }}
              />
            </div>
          )}

          {isMobile && (
            <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 60 }}>
              <OutreachMapSidebar
                data={todayRunData}
                loading={todayRunLoading}
                error={todayRunError}
                activeRunId={activeMapRunId}
                collapsedStreets={collapsedStreets}
                onToggleStreet={toggleStreet}
                onStreetSelect={(suburb, street) => {
                  setActiveMapStreet(street);
                  setReportSuburbFilter(suburb);
                }}
                onRunSelect={(runId) => {
                  setActiveMapRunId(runId);
                  setActiveMapStreet(null);
                }}
                hidden={mapSidebarHidden}
                onToggleHidden={() => setMapSidebarHidden((h) => !h)}
                streetStatusMap={mapStreetStatusMap}
                addressCounts={mapAddressCounts}
                statusFilter={mapStatusFilter}
                onStatusFilterChange={setMapStatusFilter}
                onSuburbClick={(suburb) => {
                  setMapStatusFilter('all');
                  setActiveMapStreet(null);
                  setActiveMapRunId(null);
                  setReportSuburbFilter(suburb);
                }}
              />
            </div>
          )}

          <div style={{ height: 600, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <DynamicMapView
              suburb={reportSuburbFilter || todayRunData?.suburb || firstPendingSuburb}
              activeRunId={activeMapRunId}
              selectedStreet={activeMapStreet}
              sentStatus="all"
              reportQuarter={activeQuarter || undefined}
              onCoordsLoaded={handleMapCoordsLoaded}
              statusFilter={mapStatusFilter}
              onStatusFilterChange={setMapStatusFilter}
              onRunSelect={(runId) => {
                setActiveMapRunId(runId);
                setActiveMapStreet(null);
              }}
              onStreetSelect={(suburb, street) => {
                setActiveMapStreet(street);
                setReportSuburbFilter(suburb);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySuburb.map(({ suburb, streets, totalCount }) => {
            return (
              <div key={suburb} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📂</span>
                    <div className="text-left">
                      <div className="font-semibold text-slate-800">{suburb}</div>
                      <div className="text-xs text-slate-500">
                        {streets.length} {streets.length === 1 ? 'street' : 'streets'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600">
                      {totalCount} {totalCount === 1 ? 'address' : 'addresses'}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {streets.map(({ street, properties, totalCount: streetTotal }) => {
                    const streetKey = `${suburb}::${street}`;
                    const isCollapsed = collapsedStreets.has(streetKey);
                    return (
                      <div key={street} className="bg-white">
                        <button
                          onClick={() => toggleStreet(suburb, street)}
                          className="w-full px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={streetTotal > 0 && properties.every(p => selected.has(p.id))}
                              ref={el => { if (el) { const n = properties.filter(p => selected.has(p.id)).length; el.indeterminate = n > 0 && n < properties.length; } }}
                              onChange={() => {
                                const allSelected = properties.every(p => selected.has(p.id));
                                setSelectedByTab((prev) => {
                                  const next = new Set(prev[activeTab]);
                                  if (allSelected) {
                                    properties.forEach(p => next.delete(p.id));
                                  } else {
                                    properties.forEach(p => next.add(p.id));
                                  }
                                  return { ...prev, [activeTab]: next };
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-lg">📍</span>
                            <span className="font-medium text-slate-700">{street}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">
                              {streetTotal} {streetTotal === 1 ? 'address' : 'addresses'}
                            </span>
                            <span className="text-slate-400">{isCollapsed ? '▶' : '▼'}</span>
                          </div>
                        </button>
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-50">
                            {properties.map((prop) => {
                              const actionBtns = (
                                <>
                                  {activeTab === 'liked' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (selected.size > 0) {
                                          if (!window.confirm(`Move ${selected.size} selected address${selected.size === 1 ? '' : 'es'} to Pending?`)) return;
                                          await markAsPending();
                                        } else {
                                          if (!window.confirm(`Move "${prop.property_address}" to Pending?`)) return;
                                          try {
                                            const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ status: 'pending' }),
                                            });
                                            if (!res.ok) throw new Error('Failed');
                                            await res.json();
                                            showNotification('success', 'Moved to Pending');
                                            handleMarkAsSentSuccess();
                                          } catch {
                                            showNotification('error', 'Failed to move to Pending');
                                          }
                                        }
                                      }}
                                      className="transition-colors px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                                      title="Move to Pending"
                                    >
                                      ⇨ Pending
                                    </button>
                                  )}
                                  {activeTab === 'pending' && canMarkAsSent && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!window.confirm(`Mark "${prop.property_address}" as sent?`)) return;
                                        try {
                                          const res = await fetch(`/api/admin/outreach/${prop.id}/mark-sent`, {
                                            method: 'PATCH',
                                          });
                                          if (!res.ok) throw new Error('Failed to mark as sent');
                                          await res.json();
                                          showNotification('success', 'Marked as sent');
                                          handleMarkAsSentSuccess();
                                        } catch {
                                          showNotification('error', 'Failed to mark as sent');
                                        }
                                      }}
                                      className="transition-colors px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium"
                                      title="Mark this address as sent"
                                    >
                                      ✓ Sent
                                    </button>
                                  )}
                                  {activeTab === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm(`Return "${prop.property_address}" to Liked?`)) {
                                          try {
                                            const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ status: 'liked' }),
                                            });
                                            if (!res.ok) throw new Error('Failed');
                                            await res.json();
                                            showNotification('success', 'Returned to Liked');
                                            handleMarkAsSentSuccess();
                                          } catch {
                                            showNotification('error', 'Failed to return to Liked');
                                          }
                                        }
                                      }}
                                      className="transition-colors px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                                      title="Return to Liked"
                                    >
                                      ↩ Liked
                                    </button>
                                  )}
                                  {activeTab === 'sent' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!window.confirm(`Return "${prop.property_address}" to Pending?`)) return;
                                        try {
                                          const res = await fetch(`/api/admin/outreach/${prop.id}/status`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: 'pending' }),
                                          });
                                          if (!res.ok) throw new Error('Failed');
                                          await res.json();
                                          showNotification('success', 'Returned to Pending');
                                          handleMarkAsSentSuccess();
                                        } catch {
                                          showNotification('error', 'Failed to return to Pending');
                                        }
                                      }}
                                      className="transition-colors px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-xs font-medium"
                                      title="Return to Pending"
                                    >
                                      ⇨ Pending
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openHistoryDrawer(prop.id, prop.property_address)}
                                    className="transition-colors px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded text-xs font-medium border border-slate-200"
                                    title="View dispatch history"
                                  >
                                    <FaHistory style={{ display: 'inline', marginRight: '4px' }} />
                                    {activeQuarter
                                      ? 'History'
                                      : prop.total_send_count && prop.total_send_count > 0
                                        ? `${prop.total_send_count}x Sent`
                                        : 'History'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openConvertModal(prop)}
                                    className="transition-colors px-3 py-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded text-xs font-medium border border-violet-200"
                                    title="Convert to Lead"
                                  >
                                    ⇨ Lead
                                  </button>
                                  {(activeTab === 'pending' || activeTab === 'liked' || activeTab === 'sent') && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm(`Delete "${prop.property_address}"?`)) {
                                          const itemId = prop.id;
                                          setItems((prev) => prev.filter((item) => item.id !== itemId));
                                          setClassicItems((prev) => prev.filter((item) => item.id !== itemId));
                                          try {
                                            await fetch(`/api/admin/outreach/${prop.id}`, { method: 'DELETE' });
                                            showNotification('success', 'Address deleted');
                                            window.scrollTo(0, 0);
                                          } catch {
                                            showNotification('error', 'Failed to delete');
                                          }
                                        }
                                      }}
                                      className="transition-colors px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium"
                                      title="Delete this address"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[prop.status]
                                      }`}
                                  >
                                    {STATUS_LABELS[prop.status]}
                                  </span>
                                </>
                              );
                              return (
                                <div
                                  key={prop.id}
                                  className="pl-10 pr-4 py-3 hover:bg-blue-50 transition-colors group border-l-2 border-slate-100 ml-4"
                                >
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selected.has(prop.id)}
                                      onChange={() => toggleSelect(prop.id)}
                                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <div className="font-medium text-slate-800 truncate">
                                          {prop.property_address}
                                        </div>
                                        {prop.joined_property_id && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const pid = prop.joined_property_id;
                                              if (!pid) return;
                                              const newVal = !prop.no_junk_mail;
                                              cacheRef.current.clear();
                                              setItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: newVal } : item));
                                              setClassicItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: newVal } : item));
                                              fetch(`/api/admin/properties/${pid}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ no_junk_mail: newVal }),
                                              }).catch(() => {
                                                cacheRef.current.clear();
                                                setItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: !newVal } : item));
                                                setClassicItems(prev => prev.map(item => item.id === prop.id ? { ...item, no_junk_mail: !newVal } : item));
                                              });
                                            }}
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 transition-colors ${prop.no_junk_mail
                                              ? 'bg-red-500 text-white'
                                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                              }`}
                                            title={prop.no_junk_mail ? 'No Junk Mail - click to allow' : 'Click to mark No Junk Mail'}
                                          >
                                            🚫
                                          </button>
                                        )}
                                        <div className="flex gap-2 shrink-0">
                                          {(prop.pv_url || prop.property_url) && (
                                            <a
                                              href={prop.pv_url || prop.property_url || ''}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 font-semibold"
                                              title="View on PropertyValue"
                                            >
                                              PropertyValue
                                            </a>
                                          )}
                                          {prop.realestate_url && (
                                            <a
                                              href={prop.realestate_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors border border-green-200 font-semibold"
                                              title="View on RealEstate"
                                            >
                                              RealEstate
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                        {prop.property_type && (
                                          <span className="px-2 py-0.5 bg-slate-100 rounded">
                                            {prop.property_type}
                                          </span>
                                        )}
                                        <span>Added {new Date(prop.created_at).toLocaleDateString('en-NZ')}</span>
                                        <span className="text-slate-400">
                                          {new Date(prop.created_at).toLocaleTimeString('en-NZ', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5 lg:mt-0.5">
                                    {actionBtns}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isClassic && displayItems.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
          <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
            {Math.max(1, (currentPage - 1) * pageSize + 1)}–{Math.min(currentPage * pageSize, stableDisplayTotal)} of {stableDisplayTotal}
          </span>
          <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>|</span>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568', cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >‹</button>
          <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#4a5568", whiteSpace: "nowrap" }}>
            Page{' '}
            <input type="number" value={currentPage}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } }}
              onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value, 10); if (!isNaN(v) && v >= 1 && v <= totalPages) { setCurrentPage(v); } } }}
              style={{ width: "52px", padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.9rem", fontWeight: "600", color: "#2D3748", textAlign: "center", outline: "none", MozAppearance: "textfield" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1} max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568', cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600", transition: "all 0.15s", lineHeight: "1" }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≫</button>
        </div>
      )}
      {!isClassic && hasMore && !loading && !loadingMore && (activeTab !== 'pending' || viewMode !== 'map') && (
        <div ref={lastPropertyElementRef} style={{ height: '1px' }} />
      )}

      {!isClassic && loadingMore && (activeTab !== 'pending' || viewMode !== 'map') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))' : '1fr',
          gap: viewMode === 'card' ? '20px' : '0',
        }}>
          {Array.from({ length: pageSize }).map((_, i) => (
            viewMode === 'card' ? (
              <SkeletonOutreachCard key={`skel-${i}`} />
            ) : (
              <SkeletonOutreachListRow key={`skel-${i}`} />
            )
          ))}
        </div>
      )}

      {!isClassic && !hasMore && displayItems.length > 0 && !loadingMore && (activeTab !== 'pending' || viewMode !== 'map') && (
        <div style={{
          textAlign: 'center',
          padding: '30px',
          color: '#718096',
          fontSize: '0.95rem',
          fontWeight: '500',
        }}>
          You&apos;ve reached the end! No more addresses to load.
        </div>
      )}

      {editingProperty && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }} onClick={() => setEditingProperty(null)} />
          <div style={{
            position: 'relative', backgroundColor: 'white', borderRadius: '16px',
            padding: '32px', maxWidth: '700px', width: '95%', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2D3748', marginBottom: '8px' }}>
              Edit Property
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '24px' }}>
              {editingProperty.property_address} — edits are saved to the linked Properties record
            </p>

            {/* Send History */}
            {sendHistoryLoading ? (
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ height: '20px', width: '120px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
                <div style={{ height: '60px', backgroundColor: '#e2e8f0', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
              </div>
            ) : sendHistory.length > 0 ? (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#7c3aed', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📋</span> Dispatch History
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sendHistory.map((log) => (
                    <div key={log.log_id} style={{
                      padding: '12px 14px', backgroundColor: '#f5f3ff', borderRadius: '10px',
                      border: '1px solid #ede9fe',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {log.campaign_key}
                          </span>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#2D3748', marginTop: '4px' }}>
                            {log.report_title}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#a78bfa', whiteSpace: 'nowrap' }}>
                          {new Date(log.sent_at).toLocaleDateString('en-NZ')}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '6px', display: 'flex', gap: '12px' }}>
                        <span>By: {log.sent_by}</span>
                        {log.scan_count > 0 && <span>📷 Scanned: {log.scan_count}</span>}
                      </div>
                      {log.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                          &ldquo;{log.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'suburb', label: 'Suburb', type: 'text' },
                { key: 'city', label: 'City', type: 'text' },
                { key: 'region', label: 'Region', type: 'text' },
                { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
                { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
                { key: 'car_spaces', label: 'Car Spaces', type: 'number' },
                { key: 'year_built', label: 'Year Built', type: 'number' },
                { key: 'floor_size', label: 'Floor Size (m²)', type: 'text' },
                { key: 'land_area', label: 'Land Area', type: 'text' },
                { key: 'last_sold_price', label: 'Last Sold Price', type: 'number' },
                { key: 'last_sold_date', label: 'Last Sold Date', type: 'date' },
                { key: 'capital_value', label: 'Capital Value (RV)', type: 'number' },
                { key: 'property_url', label: 'Property URL', type: 'text' },
                { key: 'cover_image_url', label: 'Cover Image URL', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={editFormData[field.key]?.toString() || ''}
                    onChange={e => handleEditFieldChange(field.key, e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '2px solid #e2e8f0', borderRadius: '8px',
                      fontSize: '0.9rem', color: '#2D3748',
                    }}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  value={editFormData.description?.toString() || ''}
                  onChange={e => handleEditFieldChange('description', e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '2px solid #e2e8f0', borderRadius: '8px',
                    fontSize: '0.9rem', color: '#2D3748', resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#4a5568', marginBottom: '4px' }}>
                  Property History
                </label>
                <PropertyHistoryView raw={editFormData.property_history?.toString() || ''} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingProperty(null)}
                style={{
                  padding: '12px 24px', backgroundColor: '#f3f4f6', color: '#4a5568',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '600', fontSize: '0.95rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: '12px 24px', backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                  color: 'white', borderRadius: '10px', border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.95rem',
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Lead Modal */}
      {convertModalOpen && convertingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConvertModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Convert to Lead</h3>
                <p className="text-xs text-slate-400 mt-0.5">{convertingProperty.property_address}</p>
              </div>
              <button onClick={() => setConvertModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Owner Email</label>
                <input type="email" value={convertForm.owner_email}
                  onChange={e => setConvertForm(p => ({ ...p, owner_email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="owner@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Owner Phone</label>
                <input type="text" value={convertForm.owner_phone}
                  onChange={e => setConvertForm(p => ({ ...p, owner_phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="021 123 4567" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Summary</label>
                <input type="text" value={convertForm.summary}
                  onChange={e => setConvertForm(p => ({ ...p, summary: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g., Called owner, interested in selling" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes (pre-filled from outreach)</label>
                <textarea value={convertForm.notes}
                  onChange={e => setConvertForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button onClick={() => setConvertModalOpen(false)} className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                <button onClick={handleConvertToLead} disabled={converting}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {converting ? 'Converting...' : 'Create Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SendReportModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        selectedIds={sendTargetIds}
        suburb={sendTargetSuburb}
        onSuccess={() => {
          showNotification('success', 'Report dispatch logged successfully');
          clearSelected();
          cacheRef.current.clear();
          if (isClassic) {
            setCurrentPage(currentPage);
          } else {
            fetchItems();
          }
          window.scrollTo(0, 0);
        }}
      />

      <DispatchHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        propertyId={historyTargetId}
        propertyAddress={historyTargetAddress}
      />
    </div>
  );
}
export function ReportFilterSection({
  availableReports, setAvailableReports,
  reportSuburbFilter, setReportSuburbFilter,
  
  activeQuarter, setActiveQuarter,
  sentStatusFilter, setSentStatusFilter,
  setSuburbFilter,
  setLastSoldPreset,
  onClearRunFilter,
}: {
  availableReports: Array<{ suburb: string; quarter: string; year: number; id: string; uploaded_at: string }>;
  setAvailableReports: React.Dispatch<React.SetStateAction<Array<{ suburb: string; quarter: string; year: number; id: string; uploaded_at: string }>>>;
  reportSuburbFilter: string;
  setReportSuburbFilter: React.Dispatch<React.SetStateAction<string>>;
  
  
  activeQuarter: string;
  setActiveQuarter: React.Dispatch<React.SetStateAction<string>>;
  sentStatusFilter: 'all' | 'sent' | 'unsent';
  setSentStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'sent' | 'unsent'>>;
  setSuburbFilter: React.Dispatch<React.SetStateAction<string>>;
  setLastSoldPreset: React.Dispatch<React.SetStateAction<string>>;
  onClearRunFilter: () => void;
}) {
  const [loaded, setLoaded] = useState(availableReports.length > 0);
  const [loading, setLoading] = useState(false);
  const [suburbSentStats, setSuburbSentStats] = useState<Record<string, { total: number; sent: number; unsent: number }>>({});
  const [showAllSuburbs, setShowAllSuburbs] = useState(false);
  const sentStatsReqIdRef = useRef(0);

  const loadSentStats = useCallback(async () => {
    const reqId = ++sentStatsReqIdRef.current;
    try {
      const url = activeQuarter
        ? `/api/admin/outreach/suburb-sent-stats?quarter=${encodeURIComponent(activeQuarter)}`
        : '/api/admin/outreach/suburb-sent-stats';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (reqId === sentStatsReqIdRef.current && data.stats) setSuburbSentStats(data.stats);
      }
    } catch { /* ignore */ }
  }, [activeQuarter]);

  useEffect(() => {
    setSuburbSentStats({});
    setShowAllSuburbs(false);
    loadSentStats();
  }, [activeQuarter, loadSentStats]);

  const loadReports = useCallback(async () => {
    if (loading || loaded) return;
    setLoading(true);

    let optimisticDefault: { suburb: string; label: string } | null = null;

    const applyDefault = async () => {
      try {
        const url = activeQuarter
          ? `/api/admin/outreach/default-report?quarter=${encodeURIComponent(activeQuarter)}`
          : '/api/admin/outreach/default-report';
        const dr = await fetch(url);
        if (dr.ok) {
          const d = await dr.json();
          if (d?.defaultReport?.suburb && d?.defaultReport?.label) {
            const { suburb, label } = d.defaultReport;
            if (!activeQuarter || label === activeQuarter) {
              optimisticDefault = { suburb, label };
              setDefaultReport(optimisticDefault);
              setSuburbFilter(suburb);
              setReportSuburbFilter(suburb);
              setActiveQuarter(label);
              setLastSoldPreset('all');
            }
          }
        }
      } catch {
      }
    };

    const loadList = async () => {
      try {
        const res = await fetch('/api/admin/pdf/reports?status=active');
        if (res.ok) {
          const data = await res.json();
          const reports = (data.reports || []).map((r: { suburb: string; quarter: string; year: number; id: string; uploaded_at?: string }) => ({
            suburb: r.suburb, quarter: r.quarter, year: r.year, id: r.id, uploaded_at: r.uploaded_at || '',
          }));
          setAvailableReports(reports);
          setLoaded(true);
          const optimistic = optimisticDefault;
          if (optimistic) {
            const exists = reports.some((r: { suburb: string; quarter: string; year: number }) =>
              r.suburb === optimistic.suburb && `${r.year}-${r.quarter}` === optimistic.label
            );
            if (!exists) {
              setDefaultReport(null);
              setSuburbFilter('Northcross');
              setReportSuburbFilter('');
              
            }
          }
        }
      } catch { /* ignore */ }
    };

    await Promise.all([applyDefault(), loadList(), loadSentStats()]);
    setLoading(false);
  }, [loading, loaded, setAvailableReports, setSuburbFilter, setReportSuburbFilter, setLastSoldPreset, loadSentStats, activeQuarter, setActiveQuarter]);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadSentStats();
    if (!loaded) {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [defaultReport, setDefaultReport] = useState<{ suburb: string; label: string } | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  const setAsDefault = async () => {
    if (!reportSuburbFilter || !activeQuarter) return;
    setSavingDefault(true);
    try {
      const res = await fetch('/api/admin/outreach/default-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: reportSuburbFilter, label: activeQuarter, quarter: activeQuarter }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setDefaultReport({ suburb: reportSuburbFilter, label: activeQuarter });
      }
    } catch { /* ignore */ }
    setSavingDefault(false);
  };

  const isCurrentDefault =
    !!defaultReport &&
    defaultReport.suburb === reportSuburbFilter &&
    defaultReport.label === activeQuarter;

  const allQuarters = useMemo(() => {
    const latestByQuarter = new Map<string, string>();
    for (const r of availableReports) {
      const label = `${r.year}-${r.quarter}`;
      const ts = r.uploaded_at || '';
      const cur = latestByQuarter.get(label);
      if (cur === undefined || ts > cur) latestByQuarter.set(label, ts);
    }
    return [...latestByQuarter.entries()]
      .sort((a, b) => (b[1] || '').localeCompare(a[1] || '') || b[0].localeCompare(a[0]))
      .map(([q]) => q);
  }, [availableReports]);

  useEffect(() => {
    if (!activeQuarter && allQuarters.length > 0) {
      setActiveQuarter(allQuarters[0]);
    }
  }, [activeQuarter, allQuarters, setActiveQuarter]);

  const orderedSuburbs = useMemo(() => {
    const latestBySuburb = new Map<string, string>();
    for (const r of availableReports) {
      if (r.suburb === 'North Shore') continue;
      if (activeQuarter) {
        const label = `${r.year}-${r.quarter}`;
        if (label !== activeQuarter) continue;
      }
      const ts = r.uploaded_at || '';
      const cur = latestBySuburb.get(r.suburb);
      if (cur === undefined || ts > cur) latestBySuburb.set(r.suburb, ts);
    }
    return [...latestBySuburb.entries()]
      .sort((a, b) => (b[1] || '').localeCompare(a[1] || '') || a[0].localeCompare(b[0]))
      .map(([s]) => s);
  }, [availableReports, activeQuarter]);

  const fullySentSuburbs = useMemo(() => {
    const set = new Set<string>();
    for (const s of orderedSuburbs) {
      const stats = suburbSentStats[s];
      if (stats && stats.unsent === 0 && stats.sent > 0) set.add(s);
    }
    return set;
  }, [orderedSuburbs, suburbSentStats]);

  const visibleSuburbs = useMemo(() => {
    if (showAllSuburbs) return orderedSuburbs;
    return orderedSuburbs.filter(s => !fullySentSuburbs.has(s));
  }, [orderedSuburbs, fullySentSuburbs, showAllSuburbs]);

  const hiddenCount = fullySentSuburbs.size;

  useEffect(() => {
    if (reportSuburbFilter && fullySentSuburbs.has(reportSuburbFilter)) {
      setShowAllSuburbs(true);
    }
  }, [reportSuburbFilter, fullySentSuburbs]);

  return (
    <>
      <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
        📋 Filter by Report
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        {availableReports.length === 0 ? (
          <button onClick={loadReports} disabled={loading}
            style={{ padding: '7px 14px', backgroundColor: '#eff6ff', color: '#2563eb', border: '2px solid #bfdbfe', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >{loading ? 'Loading...' : 'Show Reports'}</button>
        ) : allQuarters.map(label => {
          const isActive = activeQuarter === label;
          return (
            <button
              key={label}
              onClick={async () => {
                setActiveQuarter(label);
                setReportSuburbFilter('');
                setSentStatusFilter('all');
                onClearRunFilter();

                try {
                  const res = await fetch(`/api/admin/outreach/default-report?quarter=${encodeURIComponent(label)}`);
                  if (res.ok) {
                    const d = await res.json();
                    if (d?.defaultReport?.suburb && d?.defaultReport?.label === label) {
                      setDefaultReport(d.defaultReport);
                      setSuburbFilter(d.defaultReport.suburb);
                      setReportSuburbFilter(d.defaultReport.suburb);
                      setLastSoldPreset('all');
                    } else {
                      setDefaultReport(null);
                    }
                  }
                } catch { /* ignore */ }
              }}
              style={{
                padding: '7px 14px',
                backgroundColor: isActive ? '#16a34a' : '#fef2f2',
                color: isActive ? 'white' : '#dc2626',
                border: isActive ? '2px solid #16a34a' : '2px solid #fecaca',
                borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
              }}
            >
              {label}{isActive ? ' ●' : ' ○'}
            </button>
          );
        })}
      </div>
      {activeQuarter && availableReports.length > 0 && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {visibleSuburbs.map(s => (
              <button
                key={s}
                onClick={() => {
                  if (reportSuburbFilter === s) {
                    setReportSuburbFilter('');
                  } else {
                    setSuburbFilter(s);
                    setReportSuburbFilter(s);
                  }
                  
                  onClearRunFilter();
                }}
                style={{
                  padding: '7px 14px',
                  backgroundColor: reportSuburbFilter === s ? '#2563eb' : 'white',
                  color: reportSuburbFilter === s ? 'white' : '#4a5568',
                  border: reportSuburbFilter === s ? '2px solid #2563eb' : '2px solid #e2e8f0',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                  fontWeight: reportSuburbFilter === s ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {s}{defaultReport?.suburb === s ? ' ★' : ''}
              </button>
            ))}
            {!showAllSuburbs && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllSuburbs(true)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '2px solid #cbd5e1',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
              >
                More ({hiddenCount})
              </button>
            )}
            {showAllSuburbs && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllSuburbs(false)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '2px solid #cbd5e1',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
              >
                Hide
              </button>
            )}
            {reportSuburbFilter && (
              <button onClick={() => { setReportSuburbFilter('');  onClearRunFilter(); }}
                style={{ padding: '7px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
              >✕ Clear</button>
            )}
          </div>
          {reportSuburbFilter && (
            <button
              onClick={setAsDefault}
              disabled={savingDefault}
              title="Set as default report selection"
              style={{
                padding: '6px 12px',
                backgroundColor: isCurrentDefault ? '#fefce8' : '#fffbeb',
                color: isCurrentDefault ? '#16a34a' : '#b45309',
                border: isCurrentDefault ? '2px solid #fde047' : '2px solid #fcd34d',
                borderRadius: '8px', cursor: savingDefault ? 'wait' : 'pointer', fontSize: '0.8rem',
                fontWeight: '600', marginBottom: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              {savingDefault ? 'Saving…' : isCurrentDefault ? '★ Default' : '☆ Set as default report'}
            </button>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        {([
          { value: 'all' as const, label: 'All', color: '#6b7280' },
          { value: 'unsent' as const, label: 'Unsent', color: '#16a34a' },
          { value: 'sent' as const, label: 'Sent ✓', color: '#8b5cf6' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setSentStatusFilter(opt.value)}
            style={{
              padding: '6px 14px',
              backgroundColor: sentStatusFilter === opt.value ? opt.color : 'white',
              color: sentStatusFilter === opt.value ? 'white' : '#4a5568',
              border: sentStatusFilter === opt.value ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: sentStatusFilter === opt.value ? '600' : '500',
              transition: 'all 0.2s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
