'use client';

import React from 'react';

/**
 * Admin Skeleton Loading Components
 *
 * Reusable skeleton components that mirror the real page layouts.
 * All skeletons render inside the admin layout so Navbar always shows.
 */

// ─── Base pulse block ────────────────────────────────────────────────────────

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div
      data-testid="skeleton-block"
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

// ─── Stat card (3-col or 4-col grids) ────────────────────────────────────────

export function SkeletonStatCard() {
  return (
    <div
      data-testid="skeleton-stat-card"
      className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 animate-pulse"
    >
      <SkeletonBlock className="h-4 w-24 mb-3" />
      <SkeletonBlock className="h-8 w-16 mb-2" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  );
}

// ─── Table rows ──────────────────────────────────────────────────────────────

interface SkeletonTableRowsProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTableRows({ rows = 5, cols = 5 }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} data-testid="skeleton-table-row" className="border-b border-slate-50">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-6 py-4">
              <SkeletonBlock className={`h-4 ${j === 0 ? 'w-32' : 'w-24'}`} />
              {j === 0 && <SkeletonBlock className="h-3 w-20 mt-2" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Page header (title + subtitle) ──────────────────────────────────────────

export function SkeletonPageHeader() {
  return (
    <div data-testid="skeleton-page-header" className="animate-pulse">
      <SkeletonBlock className="h-8 w-48 mb-2" />
      <SkeletonBlock className="h-4 w-72" />
    </div>
  );
}

// ─── Dashboard skeleton ───────────────────────────────────────────────────────

export function SkeletonDashboard() {
  return (
    <div data-testid="skeleton-dashboard" className="space-y-6">
      <SkeletonPageHeader />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 animate-pulse">
        <div className="flex border-b border-slate-100 px-6 pt-4 gap-6">
          <SkeletonBlock className="h-5 w-20 mb-4" />
          <SkeletonBlock className="h-5 w-20 mb-4" />
        </div>
        {/* Table header */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-3 w-16" />
          ))}
        </div>
        {/* Table rows */}
        <table className="w-full">
          <tbody>
            <SkeletonTableRows rows={5} cols={5} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics skeleton ───────────────────────────────────────────────────────

export function SkeletonAnalytics() {
  return (
    <div data-testid="skeleton-analytics" className="space-y-6">
      <SkeletonPageHeader />

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* 2 chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse"
          >
            <SkeletonBlock className="h-5 w-40 mb-4" />
            <SkeletonBlock className="h-64 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Downloads skeleton ───────────────────────────────────────────────────────

export function SkeletonDownloads() {
  return (
    <div data-testid="skeleton-downloads" className="space-y-6">
      {/* Header with button */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <SkeletonBlock className="h-8 w-40 mb-2" />
          <SkeletonBlock className="h-4 w-64" />
        </div>
        <SkeletonBlock className="h-10 w-28 rounded-lg" />
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
        <div className="p-6 border-b border-gray-200">
          <SkeletonBlock className="h-5 w-40" />
        </div>
        <table className="w-full">
          <tbody>
            <SkeletonTableRows rows={6} cols={4} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Outreach skeleton ────────────────────────────────────────────────────────

export function SkeletonOutreach() {
  return (
    <div data-testid="skeleton-outreach" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <SkeletonBlock className="h-8 w-36 mb-2" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-10 w-32 rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 animate-pulse">
        <div className="flex gap-8 pb-4">
          <SkeletonBlock className="h-5 w-20" />
          <SkeletonBlock className="h-5 w-16" />
        </div>
      </div>

      {/* Content card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <SkeletonBlock className="h-16 w-16 rounded-full" />
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-4 w-72" />
          <SkeletonBlock className="h-10 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── PDF Manager skeleton ─────────────────────────────────────────────────────

export function SkeletonPDFManager() {
  return (
    <div data-testid="skeleton-pdf-manager" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <SkeletonBlock className="h-8 w-56 mb-2" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <SkeletonBlock className="h-10 w-36 rounded-lg" />
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <SkeletonBlock className="h-16 w-16 rounded-full" />
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-4 w-72" />
          <SkeletonBlock className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Reports list card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
        <div className="p-6 border-b border-gray-200">
          <SkeletonBlock className="h-5 w-40" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bookings skeleton ────────────────────────────────────────────────────────

export function SkeletonBookings() {
  return (
    <div data-testid="skeleton-bookings" className="space-y-6">
      <SkeletonPageHeader />

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 animate-pulse">
        <div className="p-6 border-b border-slate-100">
          <SkeletonBlock className="h-5 w-32" />
        </div>
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-3 w-16" />
          ))}
        </div>
        <table className="w-full">
          <tbody>
            <SkeletonTableRows rows={6} cols={5} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Properties skeleton ──────────────────────────────────────────────────────

export function SkeletonPropertyCard() {
  return (
    <div
      data-testid="skeleton-property-card"
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 animate-pulse"
    >
      {/* Image area */}
      <SkeletonBlock className="h-[220px] w-full rounded-none" />
      <div className="p-6 space-y-4">
        <SkeletonBlock className="h-5 w-3/4" />
        <SkeletonBlock className="h-4 w-1/2" />
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <div className="space-y-1">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-24" />
          </div>
          <div className="space-y-1">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-5 w-20" />
          </div>
        </div>
        <div className="flex justify-around pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-5 w-8" />
              <SkeletonBlock className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonProperties() {
  return (
    <div data-testid="skeleton-properties" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <SkeletonBlock className="h-9 w-64 mb-2" />
          <SkeletonBlock className="h-4 w-48" />
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-pulse space-y-4">
        <SkeletonBlock className="h-5 w-32 mb-2" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonBlock className="h-10 rounded-lg" />
          <SkeletonBlock className="h-10 rounded-lg" />
          <SkeletonBlock className="h-10 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Property cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonPropertyCard key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Outreach card skeleton (for infinite scroll loadingMore) ─────────────────

export function SkeletonOutreachCard() {
  return (
    <div
      data-testid="skeleton-outreach-card"
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 animate-pulse"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
    >
      {/* Image area */}
      <SkeletonBlock className="h-[220px] w-full rounded-none" />
      <div className="p-6 space-y-4">
        <SkeletonBlock className="h-5 w-3/4" />
        <SkeletonBlock className="h-4 w-1/2" />
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <div className="space-y-1">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-24" />
          </div>
          <div className="space-y-1">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-5 w-20" />
          </div>
        </div>
        <div className="flex justify-around pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <SkeletonBlock className="h-5 w-8" />
              <SkeletonBlock className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Outreach list row skeleton (for infinite scroll loadingMore in list view) ─

export function SkeletonOutreachListRow() {
  return (
    <div
      data-testid="skeleton-outreach-list-row"
      className="px-4 py-3 flex items-center gap-4 animate-pulse"
    >
      <SkeletonBlock className="h-4 w-4 rounded" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-64" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-3 w-16 rounded" />
          <SkeletonBlock className="h-3 w-32" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-7 w-16 rounded" />
        <SkeletonBlock className="h-7 w-14 rounded" />
        <SkeletonBlock className="h-7 w-8 rounded" />
      </div>
    </div>
  );
}
