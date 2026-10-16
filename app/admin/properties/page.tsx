"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient, useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  FaBed,
  FaBath,
  FaCar,
  FaRulerCombined,
  FaMapMarkerAlt,
} from "react-icons/fa";
import Image from "next/image";
import AddressAutocomplete from "@/components/property/AddressAutocomplete";
import { SkeletonProperties, SkeletonPropertyCard, SkeletonBlock } from "@/components/admin/Skeleton";
import { REGION_CITIES, CITY_SUBURBS } from "@/lib/geo-data";
import { SUBURB_PRIORITY_ORDER } from "@/lib/suburb-order";
import { extractStreetNameFromAddress } from "@/lib/street-ordering";
import type { StreetProgressEntry } from "@/lib/street-progress";
import { getFixedImageUrl } from "@/lib/google-maps";
import { PropertyHistoryView } from "@/components/admin/PropertyHistoryView";
import { openGoogleMaps, buildPropertyAddress } from "@/lib/clipboard";

const CARD_PAGE_SIZE = 9;
const LIST_PAGE_SIZE = 18;

interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  region?: string;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  rv: number | null;
  last_sold_price: number | null;
  last_sold_date: string | null;
  build_year: number | null;
  land_area: number | string | null;
  floor_area: string | null;
  image_url: string;
  property_url: string;
  realestate_url?: string | null;
  description?: string | null;
  postcode?: string | null;
  land_value?: number | null;
  improvement_value?: number | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  status?: string | null;
  property_history?: string | null;
  normalized_address?: string | null;
  address_fingerprint?: string | null;
  land_area_numeric?: string | null;
  property_type?: string | null;
  sale_status?: string | null;
  sale_status_source?: string | null;
  sale_status_updated_at?: string | null;
  estimated_value_low?: number | null;
  estimated_value_high?: number | null;
  suburb_median_price?: number | null;
  suburb_median_rent?: number | null;
  suburb_days_on_market?: number | null;
  images?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  on_market_sale?: boolean;
  sale_listing_status?: string | null;
  sale_price?: string | null;
  sale_agent?: string | null;
  on_market_rent?: boolean;
  rent_listing_status?: string | null;
  rent_price?: string | null;
  no_junk_mail?: boolean;
}

interface Filters {
  region: string;
  city: string;
  suburb: string;
  last_sold_min_years: string;
  last_sold_max_years: string;
  build_year_min: string;
  build_year_max: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  min_car_spaces: string;
  max_car_spaces: string;
  rv_min: string;
  rv_max: string;
  min_floor_area: string;
  min_land_area: string;
  max_land_area: string;
  market_premium: string;
  search: string;
}

type StreetFilterOpts = {
  filters: Filters;
  propertyFilter: 'house' | 'all' | 'townhouse';
  marketFilter: 'all' | 'for_sale' | 'for_rent' | 'rented' | 'never_rented' | 'not_listed';
  lastSoldPreset: string;
  junkFilter: 'all' | 'no_junk' | 'allow_junk';
};

function applyStreetFilters(list: Property[], opts: StreetFilterOpts): Property[] {
  let result = list;
  if (opts.propertyFilter === 'house') {
    result = result.filter((p) => !(p.address || '').includes('/'));
  } else if (opts.propertyFilter === 'townhouse') {
    result = result.filter((p) => (p.address || '').includes('/'));
  }

  if (opts.marketFilter === 'for_sale') {
    result = result.filter((p) => p.on_market_sale);
  } else if (opts.marketFilter === 'for_rent') {
    result = result.filter((p) => p.on_market_rent);
  } else if (opts.marketFilter === 'rented') {
    result = result.filter((p) => p.has_rental_history === true);
  } else if (opts.marketFilter === 'never_rented') {
    result = result.filter((p) => p.has_rental_history === false);
  } else if (opts.marketFilter === 'not_listed') {
    result = result.filter((p) => !p.on_market_sale && !p.on_market_rent && p.has_rental_history === false);
  }

  const nowMs = Date.now();
  const minYears = parseInt(opts.filters.last_sold_min_years || '');
  const maxYears = parseInt(opts.filters.last_sold_max_years || '');
  if (opts.lastSoldPreset === 'none') {
    result = result.filter((p) => !p.last_sold_date);
  } else if (minYears > 0 || maxYears > 0) {
    result = result.filter((p) => {
      const sold = new Date(p.last_sold_date || '');
      if (Number.isNaN(sold.getTime())) return false;
      const yearMs = 365.25 * 24 * 3600 * 1000;
      if (minYears > 0 && sold.getTime() > nowMs - minYears * yearMs) return false;
      if (maxYears > 0 && sold.getTime() < nowMs - maxYears * yearMs) return false;
      return true;
    });
  }

  if (opts.filters.build_year_min) {
    const min = parseInt(opts.filters.build_year_min);
    result = result.filter((p) => p.build_year !== null && p.build_year >= min);
  }
  if (opts.filters.build_year_max) {
    const max = parseInt(opts.filters.build_year_max);
    result = result.filter((p) => p.build_year !== null && p.build_year <= max);
  }
  if (opts.filters.min_bedrooms) {
    const min = parseInt(opts.filters.min_bedrooms);
    result = result.filter((p) => p.bedrooms !== null && p.bedrooms >= min);
  }
  if (opts.filters.max_bedrooms) {
    const max = parseInt(opts.filters.max_bedrooms);
    result = result.filter((p) => p.bedrooms !== null && p.bedrooms <= max);
  }
  if (opts.filters.min_bathrooms) {
    const min = parseInt(opts.filters.min_bathrooms);
    result = result.filter((p) => p.bathrooms !== null && p.bathrooms >= min);
  }
  if (opts.filters.max_bathrooms) {
    const max = parseInt(opts.filters.max_bathrooms);
    result = result.filter((p) => p.bathrooms !== null && p.bathrooms <= max);
  }
  if (opts.filters.min_car_spaces) {
    const min = parseInt(opts.filters.min_car_spaces);
    result = result.filter((p) => p.garages !== null && p.garages >= min);
  }
  if (opts.filters.max_car_spaces) {
    const max = parseInt(opts.filters.max_car_spaces);
    result = result.filter((p) => p.garages !== null && p.garages <= max);
  }
  if (opts.filters.rv_min) {
    const min = parseInt(opts.filters.rv_min);
    result = result.filter((p) => p.rv !== null && p.rv >= min);
  }
  if (opts.filters.rv_max) {
    const max = parseInt(opts.filters.rv_max);
    result = result.filter((p) => p.rv !== null && p.rv <= max);
  }
  if (opts.filters.min_floor_area) {
    const min = parseFloat(opts.filters.min_floor_area);
    result = result.filter((p) => {
      const fa = p.floor_area ? parseFloat(p.floor_area) : null;
      return fa !== null && !Number.isNaN(fa) && fa >= min;
    });
  }
  if (opts.filters.min_land_area) {
    const min = parseFloat(opts.filters.min_land_area);
    result = result.filter((p) => {
      const la = !p.land_area || p.land_area === '-' ? NaN : (typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number));
      return !Number.isNaN(la) && la >= min;
    });
  }
  if (opts.filters.max_land_area) {
    const max = parseFloat(opts.filters.max_land_area);
    result = result.filter((p) => {
      const la = !p.land_area || p.land_area === '-' ? NaN : (typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number));
      return !Number.isNaN(la) && la <= max;
    });
  }
  if (opts.filters.market_premium) {
    const threshold = parseFloat(opts.filters.market_premium) / 100.0;
    result = result.filter((p) => {
      if (!p.last_sold_price || !p.rv || p.rv <= 0) return false;
      return p.last_sold_price / p.rv > threshold;
    });
  }
  if (opts.junkFilter === 'no_junk') {
    result = result.filter((p) => p.no_junk_mail === true);
  }

  return result;
}

const PropertyCard = ({ property, isLiked, onToggleLike }: {
  property: Property;
  isLiked: boolean;
  onToggleLike: (property: Property) => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const [optimisticNoJunk, setOptimisticNoJunk] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const fixedImageUrl = getFixedImageUrl(property.image_url);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "N/A";
    if (amount === 0) return "$0";
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const descriptionText = property.description?.trim() || "";
  const displayDescription = descriptionText || "No description";

  const aiChamberText = [
    '[AI-DATA-START]',
    `Address: ${property.address}`,
    `Suburb: ${property.suburb}`,
    property.city ? `City: ${property.city}` : null,
    property.region ? `Region: ${property.region}` : null,
    property.postcode ? `Postcode: ${property.postcode}` : null,
    property.build_year ? `Year Built: ${property.build_year}` : null,
    property.bedrooms != null ? `Bedrooms: ${property.bedrooms}` : null,
    property.bathrooms != null ? `Bathrooms: ${property.bathrooms}` : null,
    property.garages != null ? `Car Spaces: ${property.garages}` : null,
    property.floor_area ? `Floor Size: ${property.floor_area}` : null,
    property.land_area ? `Land Area: ${property.land_area}` : null,
    property.rv != null ? `Capital Value (RV): ${formatCurrency(property.rv)}` : null,
    property.land_value != null ? `Land Value: ${formatCurrency(property.land_value)}` : null,
    property.improvement_value != null ? `Improvement Value: ${formatCurrency(property.improvement_value)}` : null,
    property.estimated_value_low != null && property.estimated_value_high != null
      ? `Estimated Value: ${formatCurrency(property.estimated_value_low)} - ${formatCurrency(property.estimated_value_high)}` : null,
    property.last_sold_price != null ? `Last Sold Price: ${formatCurrency(property.last_sold_price)}` : null,
    property.last_sold_date ? `Last Sold Date: ${property.last_sold_date}` : null,
    property.property_type ? `Property Type: ${property.property_type}` : null,
    property.sale_status ? `Sale Status: ${property.sale_status}` : null,
    property.has_rental_history != null ? `Has Rental History: ${property.has_rental_history ? 'Yes' : 'No'}` : null,
    property.is_currently_rented != null ? `Currently Rented: ${property.is_currently_rented ? 'Yes' : 'No'}` : null,
    property.latitude != null && property.longitude != null
      ? `Coordinates: ${property.latitude}, ${property.longitude}` : null,
    property.property_url ? `Property URL: ${property.property_url}` : null,
    property.realestate_url ? `Realestate URL: ${property.realestate_url}` : null,
    property.on_market_sale ? `For Sale: ${property.sale_listing_status || 'Yes'}${property.sale_price ? ` ${property.sale_price}` : ''}${property.sale_agent ? ` (${property.sale_agent})` : ''}` : null,
    property.on_market_rent ? `For Rent: ${property.rent_listing_status || 'Yes'}${property.rent_price ? ` ${property.rent_price}` : ''}` : null,
    property.description ? `Description: ${property.description}` : null,
    property.property_history
      ? `Property History: ${property.property_history}`
      : null,
    '[AI-DATA-END]',
  ].filter(Boolean).join('\n');

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
        backgroundColor: 'white',
        transition: "all 0.3s ease",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-8px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
      }}
    >
      <div style={{ position: "relative" }}>
        <a
          href={property.property_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", height: "220px", textDecoration: "none", color: "inherit" }}
        >
          {fixedImageUrl && !imageError ? (
            <Image
              src={fixedImageUrl}
              alt={property.address}
              unoptimized
              onError={() => setImageError(true)}
              width={400}
              height={220}
              style={{ objectFit: "cover", width: "100%", height: "220px" }}
            />
          ) : (
            <div style={{
              height: "220px",
              background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a5568",
              fontSize: "16px",
              fontWeight: "600",
            }}>
              <div style={{
                backgroundColor: "#e2e8f0",
                width: "80%",
                height: "70%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                border: "2px dashed #94a3b8",
              }}>
                <span style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>
                  No Image Available
                </span>
              </div>
            </div>
          )}
        </a>

        {property.suburb && (
          <div style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            backgroundColor: "rgba(34, 197, 94, 0.9)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "0.85rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            textTransform: "capitalize",
          }}>
            {property.suburb}
          </div>
        )}

        {/* No Junk Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const pid = property.id;
            const current = optimisticNoJunk !== null ? optimisticNoJunk : !!property.no_junk_mail;
            const newVal = !current;
            setOptimisticNoJunk(newVal);
            fetch(`/api/admin/properties/${pid}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ no_junk_mail: newVal }),
            }).then(res => {
              if (!res.ok) throw new Error('PATCH failed');
              setOptimisticNoJunk(null);
              queryClient.setQueriesData({ queryKey: ['admin-properties'] }, (oldData: Record<string, unknown> | undefined) => {
                if (!oldData) return oldData;
                if (Array.isArray(oldData.pages)) {
                  return {
                    ...oldData,
                    pages: oldData.pages.map((page: Record<string, unknown>) => ({
                      ...page,
                      properties: Array.isArray(page.properties)
                        ? page.properties.map((p: Record<string, unknown>) =>
                          p.id === pid ? { ...p, no_junk_mail: newVal } : p
                        )
                        : page.properties,
                    })),
                  };
                }
                if (Array.isArray(oldData.properties)) {
                  return {
                    ...oldData,
                    properties: oldData.properties.map((p: Record<string, unknown>) =>
                      p.id === pid ? { ...p, no_junk_mail: newVal } : p
                    ),
                  };
                }
                return oldData;
              });
            }).catch(() => {
              setOptimisticNoJunk(null);
            });
          }}
          style={{
            position: "absolute",
            top: "12px",
            right: "54px",
            background: (optimisticNoJunk !== null ? optimisticNoJunk : property.no_junk_mail) ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.85)',
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
            lineHeight: 1,
            zIndex: 2,
            transition: 'all 0.2s ease',
            color: (optimisticNoJunk !== null ? optimisticNoJunk : property.no_junk_mail) ? 'white' : '#64748b',
          }}
          title={(optimisticNoJunk !== null ? optimisticNoJunk : property.no_junk_mail) ? 'No Junk - Click to allow' : 'Click to mark No Junk'}
        >
          🚫
        </button>

        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleLike(property);
          }}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: isLiked ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.85)',
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
            transition: 'all 0.2s ease',
            color: isLiked ? 'white' : '#64748b',
            zIndex: 2,
          }}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? '\u2764' : '\u2661'}
        </button>

        {/* Built Year Badge */}
        {property.build_year && (
          <div style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            backgroundColor: "rgba(59, 130, 246, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            Built {property.build_year}
          </div>
        )}

        {/* For Sale Badge */}
        {property.on_market_sale && (
          <div style={{
            position: "absolute",
            top: property.build_year ? "52px" : "16px",
            left: "16px",
            backgroundColor: "rgba(34, 197, 94, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            For Sale{property.sale_price ? ` ${property.sale_price}` : ''}
          </div>
        )}

        {/* For Rent Badge */}
        {property.on_market_rent && (
          <div style={{
            position: "absolute",
            top: property.on_market_sale
              ? (property.build_year ? "88px" : "52px")
              : (property.build_year ? "52px" : "16px"),
            left: "16px",
            backgroundColor: "rgba(139, 92, 246, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            To Rent{property.rent_price ? ` ${property.rent_price}` : ''}
          </div>
        )}

        {/* Rented Badge (has rental history) */}
        {property.has_rental_history && (
          <div style={{
            position: "absolute",
            top: (() => {
              let count = 0;
              if (property.build_year) count++;
              if (property.on_market_sale) count++;
              if (property.on_market_rent) count++;
              return `${16 + count * 36}px`;
            })(),
            left: "16px",
            backgroundColor: "rgba(245, 158, 11, 0.9)",
            color: "white",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}>
            Rented
          </div>
        )}

        {/* Years Since Last Sold Badge */}
        {property.last_sold_date && (() => {
          const soldDate = new Date(property.last_sold_date);
          if (!Number.isNaN(soldDate.getTime())) {
            const today = new Date();
            const years = today.getFullYear() - soldDate.getFullYear();
            if (years > 0) {
              return (
                <div style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "16px",
                  backgroundColor: "rgba(249, 115, 22, 0.9)",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}>
                  Sold {years}yr{years > 1 ? 's' : ''} ago
                </div>
              );
            }
          }
          return null;
        })()}
      </div>

      <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <h3 style={{
            margin: 0,
            fontSize: "1.3rem",
            fontWeight: "700",
            color: "#2D3748",
            lineHeight: "1.3",
            flex: 1,
          }}>
            {property.address}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('open-convert-modal', { detail: property }));
                }}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#f5f3ff',
                  color: '#7c3aed',
                  border: '1px solid #c4b5fd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ede9fe'; e.currentTarget.style.borderColor = '#a78bfa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f5f3ff'; e.currentTarget.style.borderColor = '#c4b5fd'; }}
              >
                Lead
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('open-edit-modal', { detail: property }));
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
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const fullAddress = buildPropertyAddress(property.address, property.suburb, property.city, property.region, property.postcode ?? null);
                openGoogleMaps(fullAddress || property.address);
              }}
              aria-label={`Open ${property.address} in Google Maps`}
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

        <div style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "12px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          <FaMapMarkerAlt style={{ marginRight: "8px", fontSize: "1rem" }} />
          <span>{property.suburb}, {property.city}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
          {property.realestate_url && (
            <a
              href={property.realestate_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.75rem",
                color: "#16a34a",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "4px 10px",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.2s",
              }}
            >
              🏠 RealEstate
            </a>
          )}
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
          paddingBottom: "20px",
          borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>
              Last Sold
            </div>
            <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.1rem", marginBottom: "4px" }}>
              {formatDate(property.last_sold_date)}
            </div>
            <div style={{ fontWeight: "600", color: "#4a5568", fontSize: "1rem" }}>
              {formatCurrency(property.last_sold_price)}
            </div>

            {/* Price Growth Indicator */}
            {property.last_sold_price && property.rv && property.last_sold_price > 0 && property.rv > 0 && (() => {
              const growth = ((property.rv - property.last_sold_price) / property.last_sold_price) * 100;
              const isPositive = growth > 0;
              return (
                <div style={{
                  marginTop: "6px",
                  fontSize: "0.75rem",
                  color: isPositive ? "#16a34a" : "#dc2626",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}>
                  <span>{isPositive ? "↗" : "↘"}</span>
                  <span>{isPositive ? "+" : ""}{growth.toFixed(1)}% since sold</span>
                </div>
              );
            })()}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: "4px" }}>
              RV (Rating Value)
            </div>
            <div style={{ fontWeight: "700", color: "#2D3748", fontSize: "1.2rem" }}>
              {formatCurrency(property.rv)}
            </div>

            {/* Build Year under RV */}
            {property.build_year && (
              <div style={{
                marginTop: "8px",
                fontSize: "0.75rem",
                color: "#718096",
                fontWeight: "500",
              }}>
                Built in {property.build_year}
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-around",
          textAlign: "center",
          marginTop: "auto",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBed style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.bedrooms !== null ? property.bedrooms : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Beds</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaBath style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.bathrooms !== null ? property.bathrooms : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Baths</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaCar style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
              <span style={{ fontWeight: "600", color: "#2D3748", fontSize: "1.1rem" }}>
                {property.garages !== null ? property.garages : "-"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "500" }}>Cars</div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
              <FaRulerCombined style={{ marginRight: "6px", color: "#718096", fontSize: "1.1rem" }} />
            </div>
            <div style={{ fontWeight: "600", color: "#2D3748", fontSize: "0.9rem", lineHeight: "1.3" }}>
              F: {property.floor_area && property.floor_area !== "-" ? property.floor_area : "-"} m²
            </div>
            <div style={{ fontSize: "0.7rem", color: "#718096", fontWeight: "500", lineHeight: "1.3" }}>
              L: {property.land_area && property.land_area !== "-" && property.land_area !== 0 ? property.land_area : "-"} m²
            </div>
          </div>
        </div>

        {property.has_rental_history && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "14px",
            paddingTop: "10px",
            borderTop: "1px solid #fef3c7",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            borderRadius: "8px",
            padding: "8px 12px",
          }}>
            <span style={{ fontSize: "1rem" }}>📋</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#92400e" }}>
              Rented · Has rental history
            </span>
          </div>
        )}

        <div style={{
          width: "100%",
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid #e2e8f0",
          color: "#4a5568",
          fontSize: "0.9rem",
          lineHeight: 1.5,
          cursor: descriptionText ? "help" : "default",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }} title={descriptionText || undefined}>
          {displayDescription}
        </div>

        <div style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          pointerEvents: 'none',
          userSelect: 'none',
          fontSize: '1px',
          opacity: 0,
        }}>
          {aiChamberText}
        </div>
      </div>
    </div>
  );
};

export default function PropertiesPage() {
  const { status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastPropertyElementRef = useRef<HTMLDivElement>(null);
  // Caches the last known valid total so that during a Classic Pages transition
  // (page change or viewMode switch) where classicData briefly holds stale/0
  // data, totalProperties never drops to 0, preventing "Displaying 10 to 0 of 0"
  // and "Page 2 of 1" display glitches.
  const lastValidTotalRef = useRef<number>(0);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    region: "Auckland",
    city: "North Shore City",
    suburb: "Northcross",
    last_sold_min_years: "5",
    last_sold_max_years: "15",
    build_year_min: "",
    build_year_max: "",
    min_bedrooms: "",
    max_bedrooms: "",
    min_bathrooms: "",
    max_bathrooms: "",
    min_car_spaces: "",
    max_car_spaces: "",
    rv_min: "",
    rv_max: "",
    min_floor_area: "",
    min_land_area: "",
    max_land_area: "",
    market_premium: "",
    search: "",
  });
  const [addressInput, setAddressInput] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<'house' | 'all' | 'townhouse'>('house');
  const [marketStatus, setMarketStatus] = useState<'all' | 'for_sale' | 'for_rent' | 'rented' | 'never_rented' | 'not_listed'>('all');
  const [junkFilter, setJunkFilter] = useState<'all' | 'no_junk' | 'allow_junk'>('all');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [showSentOnly, setShowSentOnly] = useState(false);
  const [showUnselectedOnly, setShowUnselectedOnly] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [lastSoldPreset, setLastSoldPreset] = useState('5-15');
  const [buildYearPreset, setBuildYearPreset] = useState('all');
  const [paginationMode, setPaginationMode] = useState<'infinite' | 'classic'>('infinite');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const pageSize = viewMode === 'card' ? CARD_PAGE_SIZE : LIST_PAGE_SIZE;
  const [collapsedStreets, setCollapsedStreets] = useState<Set<string>>(new Set());
  const [streetModeApplied, setStreetModeApplied] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState('');
  const [startStreet, setStartStreet] = useState('');
  const [streetListExpanded, setStreetListExpanded] = useState(false);
  const [streetSearch, setStreetSearch] = useState('');
  const [streetItems, setStreetItems] = useState<Array<{ street: string; count: number }>>([]);
  const [allStreetNames, setAllStreetNames] = useState<string[]>([]);
  const [streetSegment, setStreetSegment] = useState<'pending' | 'done'>('pending');
  const [streetProgress, setStreetProgress] = useState<Record<string, StreetProgressEntry>>({});
  const [streetTotal, setStreetTotal] = useState(0);
  const [streetNextOffset, setStreetNextOffset] = useState<number | null>(0);
  const [streetLoading, setStreetLoading] = useState(false);
  const [streetAddresses, setStreetAddresses] = useState<Property[]>([]);
  const [streetAddressLoading, setStreetAddressLoading] = useState(false);
  const streetStartHydrated = useRef(false);
  const startStreetRef = useRef('');
  const streetNextOffsetRef = useRef<number | null>(0);

  // streetModeOn: true only when street mode is active AND a specific street has
  // been selected. Without a selectedStreet, react-query stays enabled so the
  // suburb-level list still shows while the user picks a street.
  // showLikedOnly is intentionally excluded — liked+street works via fetchPageData.
  const streetModeOn = streetModeApplied && !!filters.suburb && !!selectedStreet;
  const streetQuery = streetSearch.trim().toLowerCase();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === addressInput) return prev;
        return { ...prev, search: addressInput };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [addressInput]);

  // When address search is active, reset Property Type, Market Status, Last Sold, Built Year to "All"
  useEffect(() => {
    if (addressInput.trim()) {
      setPropertyFilter('all');
      setMarketStatus('all');
      setLastSoldPreset('all');
      setBuildYearPreset('all');
      setFilters((prev) => ({
        ...prev,
        last_sold_min_years: '',
        last_sold_max_years: '',
        build_year_min: '',
        build_year_max: '',
      }));
    }
  }, [addressInput]);

  // When Market Status is For Sale/To Rent/Not Listed, reset Last Sold and Built Year to All
  useEffect(() => {
    if (marketStatus !== 'all') {
      setLastSoldPreset('all');
      setBuildYearPreset('all');
      setFilters((prev) => ({
        ...prev,
        last_sold_min_years: '',
        last_sold_max_years: '',
        build_year_min: '',
        build_year_max: '',
      }));
    }
  }, [marketStatus]);

  // When a status filter is active, only reset last-sold presets so the status
  // view stays consistent. Do not reset Property Type here, because the user may
  // want to preserve that filter across status changes.
  useEffect(() => {
    if (showLikedOnly || showPendingOnly || showSentOnly || showUnselectedOnly) {
      setLastSoldPreset('all');
      setFilters((prev) => ({
        ...prev,
        last_sold_min_years: '',
        last_sold_max_years: '',
      }));
    }
  }, [showLikedOnly, showPendingOnly, showSentOnly, showUnselectedOnly]);

  // includeTotal: classic pagination fetches each page independently and needs
  // the API to compute the COUNT on every page (the API skips it beyond page 1
  // for infinite scroll). Infinite scroll keeps the default (skip) behaviour.
  const fetchPageData = async (pageNum: number, includeTotal = false): Promise<{ properties: Property[]; total: number }> => {
    if (showLikedOnly || showPendingOnly || showSentOnly || showUnselectedOnly) {
      // Unselected: query properties that are NOT present in outreach_enriched
      if (showUnselectedOnly) {
        const params = new URLSearchParams({ page: pageNum.toString(), limit: String(pageSize) });
        if (includeTotal) params.append('include_total', 'true');
        if (filters.suburb) params.append('suburb', filters.suburb);
        if (filters.city) params.append('city', filters.city);
        if (filters.region) params.append('region', filters.region);
        if (filters.search) params.append('search', filters.search);
        if (lastSoldPreset === 'none') params.append('last_sold_none', 'true');
        else {
          if (filters.last_sold_min_years) params.append('last_sold_min_years', filters.last_sold_min_years);
          if (filters.last_sold_max_years) params.append('last_sold_max_years', filters.last_sold_max_years);
        }
        if (filters.min_bedrooms) params.append('min_bedrooms', filters.min_bedrooms);
        if (filters.max_bedrooms) params.append('max_bedrooms', filters.max_bedrooms);
        if (filters.min_bathrooms) params.append('min_bathrooms', filters.min_bathrooms);
        if (filters.max_bathrooms) params.append('max_bathrooms', filters.max_bathrooms);
        if (filters.min_car_spaces) params.append('min_car_spaces', filters.min_car_spaces);
        if (filters.max_car_spaces) params.append('max_car_spaces', filters.max_car_spaces);
        if (filters.build_year_min) params.append('build_year_min', filters.build_year_min);
        if (filters.build_year_max) params.append('build_year_max', filters.build_year_max);
        if (filters.rv_min) params.append('rv_min', filters.rv_min);
        if (filters.rv_max) params.append('rv_max', filters.rv_max);
        if (filters.min_floor_area) params.append('min_floor_area', filters.min_floor_area);
        if (filters.min_land_area) params.append('min_land_area', filters.min_land_area);
        if (filters.max_land_area) params.append('max_land_area', filters.max_land_area);
        if (filters.market_premium) params.append('market_premium', filters.market_premium);
        if (propertyFilter === 'house') params.append('standalone_only', 'true');
        if (propertyFilter === 'townhouse') params.append('townhouse_only', 'true');
        if (marketStatus !== 'all') params.append('market_status', marketStatus);
        if (junkFilter !== 'all') params.append('no_junk_mail', junkFilter === 'no_junk' ? 'true' : 'false');
        params.append('unselected', 'true');

        const response = await fetch(`/api/admin/properties?${params}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to fetch properties');
        return { properties: result.properties, total: result.pagination.total };
      }

      // Otherwise delegate to outreach API (liked/pending/sent)
      const status = showPendingOnly ? 'pending' : (showSentOnly ? 'sent' : 'liked');
      const params = new URLSearchParams({ status, page: pageNum.toString(), limit: String(pageSize) });
      if (includeTotal) params.append('include_total', 'true');
      if (filters.suburb) params.append('suburb', filters.suburb);
      if (filters.city) params.append('city', filters.city);
      if (filters.region) params.append('region', filters.region);
      if (filters.search) params.append('search', filters.search);
      if (streetModeApplied && selectedStreet) params.append('street', selectedStreet);
      if (lastSoldPreset === 'none') params.append('last_sold_none', 'true');
      else {
        if (filters.last_sold_min_years) params.append('last_sold_min_years', filters.last_sold_min_years);
        if (filters.last_sold_max_years) params.append('last_sold_max_years', filters.last_sold_max_years);
      }
      if (propertyFilter === 'house') params.append('standalone_only', 'true');
      else if (propertyFilter === 'townhouse') params.append('townhouse_only', 'true');
      if (marketStatus !== 'all') params.append('market_status', marketStatus);
      if (junkFilter !== 'all') params.append('no_junk_mail', junkFilter === 'no_junk' ? 'true' : 'false');

      const response = await fetch(`/api/admin/outreach?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch outreach properties');

      let mapped: Property[] = result.data.map((item: Record<string, unknown>) => ({
        id: (item.joined_property_id as string) || ((item.property_id as string) ? (item.property_id as string).replace(/-/g, '') : (item.id as string)),
        address: item.property_address || '',
        suburb: item.suburb || '',
        city: item.city || '',
        region: item.region || '',
        bedrooms: item.bedrooms ?? null,
        bathrooms: item.bathrooms ?? null,
        garages: item.car_spaces ?? null,
        rv: item.capital_value ?? null,
        last_sold_price: item.last_sold_price ?? null,
        last_sold_date: item.last_sold_date ?? null,
        build_year: item.build_year ?? null,
        land_area: item.land_area ?? null,
        floor_area: item.floor_area ?? null,
        image_url: item.image_url || '',
        property_url: item.property_url || '',
        realestate_url: item.realestate_url || null,
        description: item.description || null,
        property_type: item.property_type ?? null,
        on_market_sale: item.on_market_sale ?? false,
        on_market_rent: item.on_market_rent ?? false,
        sale_listing_status: item.sale_listing_status ?? null,
        sale_price: item.sale_price ?? null,
        sale_agent: item.sale_agent ?? null,
        rent_listing_status: item.rent_listing_status ?? null,
        rent_price: item.rent_price ?? null,
        no_junk_mail: item.no_junk_mail ?? false,
      }));

      // apply same client-side filters as before
      if (filters.min_bedrooms) {
        const min = parseInt(filters.min_bedrooms);
        mapped = mapped.filter(p => p.bedrooms !== null && p.bedrooms >= min);
      }
      if (filters.max_bedrooms) {
        const max = parseInt(filters.max_bedrooms);
        mapped = mapped.filter(p => p.bedrooms !== null && p.bedrooms <= max);
      }
      if (filters.min_bathrooms) {
        const min = parseInt(filters.min_bathrooms);
        mapped = mapped.filter(p => p.bathrooms !== null && p.bathrooms >= min);
      }
      if (filters.max_bathrooms) {
        const max = parseInt(filters.max_bathrooms);
        mapped = mapped.filter(p => p.bathrooms !== null && p.bathrooms <= max);
      }
      if (filters.min_car_spaces) {
        const min = parseInt(filters.min_car_spaces);
        mapped = mapped.filter(p => p.garages !== null && p.garages >= min);
      }
      if (filters.max_car_spaces) {
        const max = parseInt(filters.max_car_spaces);
        mapped = mapped.filter(p => p.garages !== null && p.garages <= max);
      }
      if (filters.build_year_min) {
        const min = parseInt(filters.build_year_min);
        mapped = mapped.filter(p => p.build_year !== null && p.build_year >= min);
      }
      if (filters.build_year_max) {
        const max = parseInt(filters.build_year_max);
        mapped = mapped.filter(p => p.build_year !== null && p.build_year <= max);
      }
      if (filters.rv_min) {
        const min = parseInt(filters.rv_min);
        mapped = mapped.filter(p => p.rv !== null && p.rv >= min);
      }
      if (filters.rv_max) {
        const max = parseInt(filters.rv_max);
        mapped = mapped.filter(p => p.rv !== null && p.rv <= max);
      }
      if (filters.min_floor_area) {
        const min = parseFloat(filters.min_floor_area);
        mapped = mapped.filter(p => {
          const fa = p.floor_area ? parseFloat(p.floor_area) : null;
          return fa !== null && !isNaN(fa) && fa >= min;
        });
      }
      if (filters.min_land_area) {
        const min = parseFloat(filters.min_land_area);
        mapped = mapped.filter(p => {
          const la = typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number);
          return la !== null && !isNaN(la) && la >= min;
        });
      }
      if (filters.max_land_area) {
        const max = parseFloat(filters.max_land_area);
        mapped = mapped.filter(p => {
          const la = typeof p.land_area === 'string' ? parseFloat(p.land_area) : (p.land_area as number);
          return la !== null && !isNaN(la) && la <= max;
        });
      }
      if (filters.market_premium) {
        const threshold = parseFloat(filters.market_premium) / 100.0;
        mapped = mapped.filter(p => {
          if (!p.last_sold_price || !p.rv || p.rv <= 0) return false;
          return (p.last_sold_price / p.rv) > threshold;
        });
      }

      if (streetModeApplied && selectedStreet) {
        mapped = mapped.filter(p => extractStreetName(p.address) === selectedStreet);
      }

      return { properties: mapped, total: result.pagination.total };
    }

    const params = new URLSearchParams({
      page: pageNum.toString(),
      limit: String(pageSize),
    });
    if (includeTotal) params.append("include_total", "true");

    if (filters.suburb) {
      params.append("suburb", filters.suburb);
    }
    if (filters.city) params.append("city", filters.city);
    if (filters.region) params.append("region", filters.region);
    if (filters.search) params.append("search", filters.search);
    if (lastSoldPreset === 'none') {
      params.append("last_sold_none", "true");
    } else {
      if (filters.last_sold_min_years) params.append("last_sold_min_years", filters.last_sold_min_years);
      if (filters.last_sold_max_years) params.append("last_sold_max_years", filters.last_sold_max_years);
    }
    if (filters.min_bedrooms) params.append("min_bedrooms", filters.min_bedrooms);
    if (filters.max_bedrooms) params.append("max_bedrooms", filters.max_bedrooms);
    if (filters.min_bathrooms) params.append("min_bathrooms", filters.min_bathrooms);
    if (filters.max_bathrooms) params.append("max_bathrooms", filters.max_bathrooms);
    if (filters.min_car_spaces) params.append("min_car_spaces", filters.min_car_spaces);
    if (filters.max_car_spaces) params.append("max_car_spaces", filters.max_car_spaces);
    if (filters.build_year_min) params.append("build_year_min", filters.build_year_min);
    if (filters.build_year_max) params.append("build_year_max", filters.build_year_max);
    if (filters.rv_min) params.append("rv_min", filters.rv_min);
    if (filters.rv_max) params.append("rv_max", filters.rv_max);
    if (filters.min_floor_area) params.append("min_floor_area", filters.min_floor_area);
    if (filters.min_land_area) params.append("min_land_area", filters.min_land_area);
    if (filters.max_land_area) params.append("max_land_area", filters.max_land_area);
    if (filters.market_premium) params.append("market_premium", filters.market_premium);
    if (propertyFilter === 'house') params.append("standalone_only", "true");
    if (propertyFilter === 'townhouse') params.append("townhouse_only", "true");
    if (marketStatus !== 'all') params.append("market_status", marketStatus);
    if (junkFilter !== 'all') params.append("no_junk_mail", junkFilter === 'no_junk' ? 'true' : 'false');

    const response = await fetch(`/api/admin/properties?${params}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch properties");
    }

    return { properties: result.properties, total: result.pagination.total };
  };

  const {
    data: infiniteData,
    isFetchingNextPage,
    isLoading,
    isFetching,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<{ properties: Property[]; total: number }, Error>({
    queryKey: ["admin-properties", "infinite", filters, propertyFilter, lastSoldPreset, buildYearPreset, showLikedOnly, showPendingOnly, showSentOnly, showUnselectedOnly, marketStatus, junkFilter, streetModeApplied ? selectedStreet : '', viewMode],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => fetchPageData((pageParam as number) || 1),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage && lastPage.properties.length === pageSize) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    enabled: paginationMode === 'infinite' && status === "authenticated" && !streetModeOn,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: classicData,
    isLoading: classicLoading,
    isFetching: classicFetching,
  } = useQuery<{ properties: Property[]; total: number }, Error>({
    queryKey: ["admin-properties", "classic", filters, propertyFilter, lastSoldPreset, buildYearPreset, showLikedOnly, showPendingOnly, showSentOnly, showUnselectedOnly, currentPage, marketStatus, junkFilter, streetModeApplied ? selectedStreet : '', viewMode],
    // includeTotal=true: each classic page is fetched independently, so the API
    // must compute the real COUNT for every page (it skips it beyond page 1 for
    // infinite scroll, which would make totalPages collapse to 1 and bounce the
    // pager back to page 1).
    queryFn: async () => fetchPageData(currentPage, true),
    placeholderData: keepPreviousData,
    enabled: paginationMode === 'classic' && status === "authenticated" && !streetModeOn,
    staleTime: 5 * 60 * 1000,
  });

  const isClassic = paginationMode === 'classic';
  const propertiesData = infiniteData as { pages: { properties: Property[]; total: number }[] } | undefined;
  const allInfiniteProperties: Property[] = propertiesData ? propertiesData.pages.flatMap((page) => page.properties) : [];
  const properties: Property[] = isClassic ? (classicData?.properties ?? []) : allInfiniteProperties;
  let displayProperties: Property[] = properties;
  let streetAllLength = 0;
  const [likedPropertyIds, setLikedPropertyIds] = useState<Set<string>>(new Set());

  const extractStreetName = (address: string): string => extractStreetNameFromAddress(address);

  const extractHouseNumber = (address: string): { houseNumber: number; unitNumber: number } => {
    const clean = address.trim();
    const unitMatch = clean.match(/^-?(\d+)\/(\d+)/);
    if (unitMatch) {
      return { houseNumber: parseInt(unitMatch[2], 10), unitNumber: parseInt(unitMatch[1], 10) };
    }
    const numMatch = clean.match(/^-?(\d+)/);
    return { houseNumber: numMatch ? parseInt(numMatch[1], 10) : 999999, unitNumber: 0 };
  };

  if (streetModeOn) {
    const clientFiltered = applyStreetFilters(streetAddresses, {
      filters,
      propertyFilter,
      marketFilter: marketStatus,
      lastSoldPreset,
      junkFilter,
    });
    // When liked mode is on, further narrow to only properties the user has liked.
    const afterLiked = showLikedOnly
      ? clientFiltered.filter((p) => likedPropertyIds.has(p.id))
      : clientFiltered;
    const filtered = selectedStreet
      ? afterLiked.filter((p) => extractStreetName(p.address) === selectedStreet)
      : afterLiked;
    streetAllLength = filtered.length;
    if (isClassic) {
      const perPage = pageSize;
      const start = (currentPage - 1) * perPage;
      displayProperties = filtered.slice(start, start + perPage);
    } else {
      displayProperties = filtered;
    }
  }

  const groupedBySuburb = useMemo(() => {
    const groups = new Map<string, Map<string, Property[]>>();
    displayProperties.forEach((item) => {
      const suburb = item.suburb || 'Unknown';
      const street = extractStreetName(item.address);
      if (!groups.has(suburb)) {
        groups.set(suburb, new Map());
      }
      const streetMap = groups.get(suburb)!;
      if (!streetMap.has(street)) {
        streetMap.set(street, []);
      }
      streetMap.get(street)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([suburb, streetMap]) => {
        const streets = Array.from(streetMap.entries())
          .map(([street, props]) => ({
            street,
            properties: [...props].sort((a, b) => {
              const ha = extractHouseNumber(a.address);
              const hb = extractHouseNumber(b.address);
              if (ha.houseNumber !== hb.houseNumber) return ha.houseNumber - hb.houseNumber;
              if (ha.unitNumber !== hb.unitNumber) return ha.unitNumber - hb.unitNumber;
              return a.address.localeCompare(b.address, undefined, { sensitivity: 'base' });
            }),
            totalCount: props.length,
          }))
          .sort((a, b) => a.street.localeCompare(b.street, undefined, { sensitivity: 'base' }));

        return {
          suburb,
          streets,
          totalCount: streets.reduce((sum, s) => sum + s.totalCount, 0),
        };
      })
      .sort((a, b) => a.suburb.localeCompare(b.suburb, undefined, { sensitivity: 'base' }));
  }, [displayProperties]);
  const toggleStreet = (suburb: string, street: string) => {
    const key = `${suburb}::${street}`;
    setCollapsedStreets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadStreetList = useCallback(async (mode: 'reset' | 'append', explicitStart?: string) => {
    if (!filters.suburb) return;
    const start = explicitStart !== undefined ? explicitStart : startStreetRef.current;
    setStreetLoading(true);
    const offset = mode === 'append' && streetNextOffsetRef.current != null ? streetNextOffsetRef.current : 0;
    const params = new URLSearchParams({ suburb: filters.suburb, limit: '11' });
    if (start) params.set('start', start);
    if (offset > 0) params.set('offset', offset.toString());
    try {
      const res = await fetch(`/api/admin/properties/street?${params}`);
      const data = await res.json();
      if (data.success) {
        if (mode === 'append') {
          setStreetItems((prev) => [...prev, ...(data.streets ?? [])]);
        } else {
          setStreetItems(data.streets ?? []);
        }
        setStreetTotal(data.totalStreets ?? 0);
        streetNextOffsetRef.current = data.next_offset ?? null;
        setStreetNextOffset(streetNextOffsetRef.current);
        if (!streetStartHydrated.current && data.saved_start) {
          streetStartHydrated.current = true;
          startStreetRef.current = data.saved_start;
          setStartStreet(data.saved_start);
        }
      }
    } catch {
      // ignore
    } finally {
      setStreetLoading(false);
    }
  }, [filters.suburb]);

  const loadAllStreets = useCallback(async () => {
    if (!filters.suburb) return;
    const params = new URLSearchParams({ suburb: filters.suburb, limit: '500' });
    try {
      const res = await fetch(`/api/admin/properties/street?${params}`);
      const data = await res.json();
      if (data.success) {
        // Prefer the dedicated allStreetNames field (alphabetically sorted, full list).
        // Fall back to sorting the streets array for older API responses.
        let names: string[];
        if (Array.isArray(data.allStreetNames)) {
          names = data.allStreetNames.map((s: { street: string }) => s.street);
        } else {
          names = (data.streets ?? []).map((s: { street: string }) => s.street);
          names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        }
        setAllStreetNames(names);
      }
    } catch {
      // ignore
    }
  }, [filters.suburb]);

  const loadStreetProgress = useCallback(async () => {
    if (!filters.suburb) return;
    // Check sessionStorage first — progress rarely changes between page loads
    const ssKey = `street_progress:${filters.suburb.toLowerCase()}`;
    try {
      const cached = sessionStorage.getItem(ssKey);
      if (cached) {
        setStreetProgress(JSON.parse(cached));
        return; // 0 RU — served from sessionStorage
      }
    } catch { /* sessionStorage unavailable */ }
    try {
      const res = await fetch(`/api/admin/properties/street/progress?suburb=${encodeURIComponent(filters.suburb)}`);
      const data = await res.json();
      if (data.success && data.progress) {
        setStreetProgress(data.progress);
        try { sessionStorage.setItem(ssKey, JSON.stringify(data.progress)); } catch { /* ignore */ }
      }
    } catch {
      // ignore
    }
  }, [filters.suburb]);

  const saveStreetProgress = useCallback(async (street: string, status: 'in_progress' | 'completed', likedCount?: number) => {
    if (!filters.suburb || !street) return;
    try {
      const res = await fetch('/api/admin/properties/street/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: filters.suburb, street, status, liked_count: likedCount }),
      });
      const data = await res.json();
      if (data.success && data.entry) {
        setStreetProgress((prev) => {
          const updated = { ...prev, [street]: data.entry };
          // Keep sessionStorage in sync so the next loadStreetProgress call is still fresh
          try {
            const ssKey = `street_progress:${filters.suburb.toLowerCase()}`;
            sessionStorage.setItem(ssKey, JSON.stringify(updated));
          } catch { /* ignore */ }
          return updated;
        });
      }
    } catch {
      // ignore
    }
  }, [filters.suburb]);

  const undoStreetComplete = useCallback((street: string) => {
    saveStreetProgress(street, 'in_progress');
  }, [saveStreetProgress]);

  const completedStreets = useMemo(() =>
    Object.values(streetProgress)
      .filter((e) => e.status === 'completed')
      .sort((a, b) => ((b.completed_at ?? '') < (a.completed_at ?? '') ? -1 : 1)),
    [streetProgress]);

  const pendingStreets = useMemo(() =>
    streetItems.filter((s) => streetProgress[s.street]?.status !== 'completed'),
    [streetItems, streetProgress]);

  const loadStreetAddresses = useCallback(async (street: string) => {
    if (!filters.suburb || !street) return;
    setStreetAddressLoading(true);
    setStreetAddresses([]);
    const params = new URLSearchParams({ suburb: filters.suburb, street, limit: '3000', skip_count: 'true' });
    try {
      const res = await fetch(`/api/admin/properties?${params}`);
      const data = await res.json();
      if (data.success) setStreetAddresses((data.properties as Property[]) ?? []);
    } catch {
      // ignore
    } finally {
      setStreetAddressLoading(false);
    }
  }, [filters.suburb]);

  const markStreetComplete = useCallback((street: string) => {
    if (!street) return;
    const likedCount = streetAddresses.filter((a) => likedPropertyIds.has(a.id)).length;
    saveStreetProgress(street, 'completed', likedCount);
    // auto advance to the next pending street in the walking route
    const idx = streetItems.findIndex((s) => s.street === street);
    let nextIdx = idx + 1;
    while (nextIdx < streetItems.length && streetProgress[streetItems[nextIdx].street]?.status === 'completed') {
      nextIdx++;
    }
    if (nextIdx < streetItems.length) {
      const next = streetItems[nextIdx].street;
      setSelectedStreet(next);
      loadStreetAddresses(next);
    } else {
      loadStreetList('append');
      setSelectedStreet('');
    }
  }, [saveStreetProgress, streetItems, streetProgress, streetAddresses, likedPropertyIds, loadStreetAddresses, loadStreetList]);

  useEffect(() => {
    setSelectedStreet('');
    setStreetListExpanded(!!(filters.suburb && streetModeApplied));
    streetStartHydrated.current = false;
    startStreetRef.current = '';
    setStartStreet('');
    streetNextOffsetRef.current = 0;
    setStreetNextOffset(0);
    setStreetItems([]);
    setStreetAddresses([]);
    setAllStreetNames([]);
    setStreetProgress({});
    if (filters.suburb && streetModeApplied) {
      loadAllStreets();
      loadStreetProgress();
      loadStreetList('reset');
    }
    if (!filters.suburb) {
      setStreetModeApplied(false);
    }
  }, [filters.suburb, streetModeApplied, loadAllStreets, loadStreetProgress, loadStreetList]);

  const handleApplyStreet = () => {
    const next = !streetModeApplied;
    streetStartHydrated.current = false;
    startStreetRef.current = '';
    streetNextOffsetRef.current = 0;
    setStreetModeApplied(next);
    setSelectedStreet('');
    setStartStreet('');
    setStreetListExpanded(!!next);
    setStreetItems([]);
    setStreetNextOffset(0);
    setStreetAddresses([]);
    setCurrentPage(1);
    if (next) loadStreetList('reset');
  };

  const handleStartStreetChange = (value: string) => {
    startStreetRef.current = value;
    streetNextOffsetRef.current = 0;
    setStartStreet(value);
    setSelectedStreet(value);
    streetStartHydrated.current = true;
    if (value) {
      fetch('/api/admin/properties/street', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: filters.suburb, start: value }),
      }).catch(() => { });
      loadStreetAddresses(value);
    } else {
      setStreetAddresses([]);
    }
    setStreetListExpanded(true);
    loadStreetList('reset', value);
  };

  const toggleStreetList = () => {
    const expand = !streetListExpanded;
    setStreetListExpanded(expand);
    if (expand && streetItems.length === 0) loadStreetList('reset');
  };

  const toggleStreetSelection = (street: string) => {
    const next = selectedStreet === street ? '' : street;
    setSelectedStreet(next);
    if (next) {
      loadStreetAddresses(next);
    } else {
      setStreetAddresses([]);
    }
  };

  const rawTotalProperties = streetModeOn
    ? streetAllLength
    : (isClassic ? (classicData?.total ?? 0) : (propertiesData?.pages[0]?.total ?? 0));
  // Keep the last non-zero total from BOTH query sources so a Classic Pages
  // transition (infinite→classic mode switch, where the classic query key has
  // no cached/placeholder data yet and classicData is briefly undefined) never
  // drops the counter to 0 — preventing "Displaying 0 of 0 properties" and
  // "Page 2 of 1" glitches. A loaded-but-genuinely-empty result (classicData
  // defined with total 0) still displays as 0.
  if (rawTotalProperties > 0) lastValidTotalRef.current = rawTotalProperties;
  // total=0 needs context to interpret:
  //   - classicData undefined            → transition, reuse the cached total
  //   - classic page ≥ 2 with total=0    → the API skipped the COUNT (infinite-
  //     scroll optimisation; also covers responses cached before include_total
  //     was added), reuse the cached total — it is NOT a genuine empty result
  //   - classic page 1 with total=0      → genuine empty result, show 0
  const totalProperties = rawTotalProperties > 0
    ? rawTotalProperties
    : (isClassic && (classicData === undefined || currentPage > 1) ? lastValidTotalRef.current : 0);
  const totalPages = Math.max(1, Math.ceil(totalProperties / pageSize));

  useEffect(() => {
    if (isClassic) return;
    if (!propertiesData) return;
    setCurrentPage(propertiesData.pages.length);
  }, [isClassic, propertiesData]);

  // Clamp the classic page into the valid range once real data is loaded
  // (e.g. the total shrank after a refetch), so the UI can't show "Page 9 of 5".
  // Skipped while classicData is undefined (transition) so the lastValidTotalRef
  // fallback keeps the previous page number stable during the fetch.
  useEffect(() => {
    if (!isClassic || classicData === undefined) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [isClassic, classicData, currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, propertyFilter, lastSoldPreset, showLikedOnly, showPendingOnly, showSentOnly, showUnselectedOnly, viewMode]);

  const propertyIds = !showLikedOnly
    ? (streetModeOn ? streetAddresses : properties).map(p => p.id).filter(Boolean).join(',')
    : '';

  useEffect(() => {
    if (!propertyIds) return;
    fetch(`/api/admin/outreach/like?property_ids=${propertyIds}`)
      .then(res => res.json())
      .then(data => {
        if (data.liked_ids) {
          setLikedPropertyIds(new Set(data.liked_ids));
        }
      })
      .catch(() => { });
  }, [propertyIds]);

  const handleToggleLike = async (property: Property) => {
    const wasLiked = likedPropertyIds.has(property.id);
    setLikedPropertyIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(property.id);
      else next.add(property.id);
      return next;
    });
    try {
      const res = await fetch('/api/admin/outreach/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          property_address: property.address,
          suburb: property.suburb,
          city: property.city,
          region: property.region || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.liked === undefined) {
        setLikedPropertyIds(prev => {
          const next = new Set(prev);
          if (wasLiked) next.add(property.id);
          else next.delete(property.id);
          return next;
        });
      }
    } catch {
      setLikedPropertyIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(property.id);
        else next.delete(property.id);
        return next;
      });
    }
  };

  const handleUnselect = async (property: Property) => {
    // Optimistically update UI
    setLikedPropertyIds(prev => {
      const next = new Set(prev);
      next.delete(property.id);
      return next;
    });
    try {
      const res = await fetch('/api/admin/outreach/unselect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: property.id }),
      });
      await res.json();
      if (!res.ok) {
        // revert
        setLikedPropertyIds(prev => {
          const next = new Set(prev);
          next.add(property.id);
          return next;
        });
      }
    } catch {
      setLikedPropertyIds(prev => {
        const next = new Set(prev);
        next.add(property.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (isClassic) return;
    const currentElement = lastPropertyElementRef.current;
    if (!currentElement) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        console.log("Fetching next page...");
        fetchNextPage();
      }
    }, { threshold: 0, rootMargin: "200px" });

    observer.observe(currentElement);

    return () => {
      observer.disconnect();
    };
  }, [isClassic, hasNextPage, isFetchingNextPage, fetchNextPage, propertiesData, viewMode]);

  const currentCitySuburbs = CITY_SUBURBS[filters.city] || [];
  const SUBURB_ORDER = ['North Shore', ...SUBURB_PRIORITY_ORDER];
  const sortedSuburbs = [...currentCitySuburbs].sort((a, b) => {
    const ai = SUBURB_ORDER.indexOf(a);
    const bi = SUBURB_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const firstSuburbForCity = (city: string): string => {
    const order = SUBURB_PRIORITY_ORDER as readonly string[];
    const sorted = [...(CITY_SUBURBS[city] || [])].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted[0] || 'Northcross';
  };

  const handleRegionChange = (region: string) => {
    const cities = REGION_CITIES[region as keyof typeof REGION_CITIES] || [];
    const defaultCity = cities[0] || "";
    setFilters((prev) => ({
      ...prev,
      region,
      city: defaultCity,
      suburb: firstSuburbForCity(defaultCity),
    }));
  };

  const handleCityChange = (city: string) => {
    setFilters((prev) => ({
      ...prev,
      city,
      suburb: firstSuburbForCity(city),
    }));
  };

  const handleFilterChange = (key: keyof Filters, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleLastSoldPreset = (preset: string) => {
    setLastSoldPreset(preset);
    switch (preset) {
      case '5-15':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '5', last_sold_max_years: '15' }));
        break;
      case '5-10':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '5', last_sold_max_years: '10' }));
        break;
      case '3-5':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '3', last_sold_max_years: '5' }));
        break;
      case '0-3':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '0', last_sold_max_years: '3' }));
        break;
      case '10-15':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '10', last_sold_max_years: '15' }));
        break;
      case '15+':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '15', last_sold_max_years: '' }));
        break;
      case 'all':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '', last_sold_max_years: '' }));
        break;
      case 'none':
        setFilters((prev) => ({ ...prev, last_sold_min_years: '', last_sold_max_years: '' }));
        break;
    }
  };

  const handleBuildYearPreset = (preset: string) => {
    setBuildYearPreset(preset);
    const currentYear = new Date().getFullYear();
    switch (preset) {
      case '<5':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 5 + 1).toString(), build_year_max: '' }));
        break;
      case '5-10':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 10).toString(), build_year_max: (currentYear - 5).toString() }));
        break;
      case '10-20':
        setFilters((prev) => ({ ...prev, build_year_min: (currentYear - 20).toString(), build_year_max: (currentYear - 10 - 1).toString() }));
        break;
      case '20+':
        setFilters((prev) => ({ ...prev, build_year_min: '', build_year_max: (currentYear - 20 - 1).toString() }));
        break;
      case 'all':
        setFilters((prev) => ({ ...prev, build_year_min: '', build_year_max: '' }));
        break;
    }
  };

  const handleClearFilters = () => {
    setAddressInput("");
    setShowLikedOnly(false);
    setLastSoldPreset('5-15');
    setBuildYearPreset('all');
    setMarketStatus('all');
    setFilters({
      region: "Auckland",
      city: "North Shore City",
      suburb: "Northcross",
      last_sold_min_years: "5",
      last_sold_max_years: "15",
      build_year_min: "",
      build_year_max: "",
      min_bedrooms: "",
      max_bedrooms: "",
      min_bathrooms: "",
      max_bathrooms: "",
      min_car_spaces: "",
      max_car_spaces: "",
      rv_min: "",
      rv_max: "",
      min_floor_area: "",
      min_land_area: "",
      max_land_area: "",
      market_premium: "",
      search: "",
    });
  };

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);

  // Convert to Lead
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingProperty, setConvertingProperty] = useState<Property | null>(null);
  const [convertForm, setConvertForm] = useState({ owner_name: '', owner_email: '', owner_phone: '', summary: '', notes: '' });
  const [converting, setConverting] = useState(false);

  const openConvertModal = (prop: Property) => {
    setConvertingProperty(prop);
    setConvertForm({
      owner_name: '',
      owner_email: '',
      owner_phone: '',
      summary: '',
      notes: '',
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
          property_address: convertingProperty.address,
          property_id: convertingProperty.id,
          suburb: convertingProperty.suburb,
          city: convertingProperty.city,
          region: convertingProperty.region,
          owner_name: convertForm.owner_name || null,
          owner_email: convertForm.owner_email || null,
          owner_phone: convertForm.owner_phone || null,
          source: 'property',
          status: 'new',
          priority: 'medium',
          summary: convertForm.summary || null,
          notes: convertForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to convert');
      showNotification('success', `Lead created for ${convertingProperty.address}`);
      setConvertModalOpen(false);
      setConvertingProperty(null);
    } catch {
      showNotification('error', 'Failed to convert to lead');
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const prop = (e as CustomEvent).detail as Property;
      setEditingProperty(prop);
      setEditFormData({
        address: prop.address || '',
        suburb: prop.suburb || '',
        city: prop.city || '',
        region: prop.region || '',
        postcode: '',
        bedrooms: prop.bedrooms?.toString() || '',
        bathrooms: prop.bathrooms?.toString() || '',
        car_spaces: prop.garages?.toString() || '',
        year_built: prop.build_year?.toString() || '',
        floor_size: prop.floor_area || '',
        land_area: prop.land_area?.toString() || '',
        last_sold_price: prop.last_sold_price?.toString() || '',
        last_sold_date: prop.last_sold_date ? prop.last_sold_date.split('T')[0] : '',
        capital_value: prop.rv?.toString() || '',
        property_url: prop.property_url || '',
        cover_image_url: prop.image_url || '',
        description: prop.description || '',
        property_history: prop.property_history || '',
      });
    };
    window.addEventListener('open-edit-modal', handler);
    return () => window.removeEventListener('open-edit-modal', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const prop = (e as CustomEvent).detail as Property;
      openConvertModal(prop);
    };
    window.addEventListener('open-convert-modal', handler);
    return () => window.removeEventListener('open-convert-modal', handler);
  }, []);

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingProperty) return;
    setSaving(true);
    try {
      const payload: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(editFormData)) {
        if (value !== '' && value !== undefined) {
          payload[key] = value;
        } else {
          payload[key] = null;
        }
      }
      const response = await fetch(`/api/admin/properties/${editingProperty.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update property');
      }
      if (result.property) {
        const updated = result.property as Property;
        // 无刷新：直接更新 React Query 缓存里的属性数据，不重新请求
        queryClient.setQueriesData(
          { queryKey: ["admin-properties"] },
          (oldData: Record<string, unknown> | undefined) => {
            if (!oldData) return oldData;
            const patchItem = (p: Record<string, unknown>) =>
              p.id === updated.id ? { ...p, ...updated } : p;
            // infinite scroll 模式
            if (Array.isArray(oldData.pages)) {
              return {
                ...oldData,
                pages: (oldData.pages as Record<string, unknown>[]).map((page) => ({
                  ...page,
                  properties: Array.isArray(page.properties)
                    ? (page.properties as Record<string, unknown>[]).map(patchItem)
                    : page.properties,
                })),
              };
            }
            // classic 分页模式
            if (Array.isArray(oldData.properties)) {
              return {
                ...oldData,
                properties: (oldData.properties as Record<string, unknown>[]).map(patchItem),
              };
            }
            return oldData;
          }
        );
      }
      showNotification('success', 'Property updated successfully');
      setEditingProperty(null);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  // Show skeleton while session resolves or initial data loads — Navbar stays visible
  if (status === "loading" || (isLoading && properties.length === 0)) {
    return <SkeletonProperties />;
  }

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
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100,
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          backgroundColor: notification.type === 'success' ? '#22c55e' : '#ef4444',
          color: 'white',
          fontWeight: '600',
          fontSize: '0.95rem',
        }}>
          {notification.msg}
        </div>
      )}

      {/* Filters Section */}
      <div style={{
        marginBottom: "32px",
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "600", color: "#2D3748" }}>
            Search Filters
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#718096" }}>
            {totalProperties === 0
              ? 'Displaying 0 of 0 properties'
              : `Displaying ${displayProperties.length} of ${totalProperties} properties`}
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "6px" }}>
            Search by Address
          </label>
          <AddressAutocomplete
            value={addressInput}
            city={filters.city}
            useGoogleMaps={true}
            onChange={(val) => {
              setAddressInput(val);
            }}
            onSelect={(suggestion) => {
              setAddressInput(suggestion.address);
              setFilters((prev) => ({
                ...prev,
                search: suggestion.address,
                suburb: suggestion.suburb || prev.suburb,
              }));
            }}
            placeholder={`Search by address in ${filters.city}...`}
          />
        </div>

        {/* Quick Suburb Filter Buttons */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "10px" }}>
            Quick Filter by Suburb
          </label>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center"
          }}>
            {SUBURB_PRIORITY_ORDER.filter((s) => !streetModeApplied || s === filters.suburb).map((suburb) => (
              <button
                key={suburb}
                onClick={() => {
                  if (filters.suburb === suburb) return;
                  setAddressInput('');
                  setFilters(prev => ({
                    ...prev,
                    search: '',
                    suburb,
                  }));
                }}
                style={{
                  padding: '10px 18px',
                  backgroundColor: filters.suburb === suburb ? '#3b82f6' : 'white',
                  color: filters.suburb === suburb ? 'white' : '#4a5568',
                  border: filters.suburb === suburb ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: filters.suburb === suburb ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: filters.suburb === suburb ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (filters.suburb !== suburb) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (filters.suburb !== suburb) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {suburb}
              </button>
            ))}
          </div>
        </div>

        {/* Filter by Street */}
        <div style={{ marginBottom: "20px", padding: "16px", border: "1px solid #e2e8f0", borderRadius: "12px", backgroundColor: streetModeApplied ? "#f0f9ff" : "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", display: "flex", alignItems: "center", gap: "6px" }}>
              🗺️ Filter by Street
            </label>
            {filters.suburb && (
              <button
                onClick={handleApplyStreet}
                style={{
                  padding: '8px 18px',
                  backgroundColor: streetModeApplied ? '#3b82f6' : 'white',
                  color: streetModeApplied ? 'white' : '#4a5568',
                  border: streetModeApplied ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: streetModeApplied ? '600' : '500',
                  transition: 'all 0.2s ease',
                }}
              >
                {streetModeApplied ? '\u2713 Applied (click to cancel)' : 'Apply'}
              </button>
            )}
          </div>

          {filters.suburb && !streetModeApplied && (
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
              Pick a start street below to order addresses by walking route for <strong>{filters.suburb}</strong>, then press the button to begin.
            </p>
          )}

          {streetModeApplied && filters.suburb && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Start street
                </label>
                <select
                  value={startStreet}
                  onChange={(e) => handleStartStreetChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    color: "#334155",
                    backgroundColor: "white",
                  }}
                >
                  <option value="">Auto (first available)</option>
                  {allStreetNames.map((name) => (
                    <option key={name} value={name}>{name}{streetProgress[name]?.status === 'completed' ? ' \u2713' : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <button
                  onClick={() => setStreetSegment('pending')}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: streetSegment === 'pending' ? '#3b82f6' : 'white',
                    color: streetSegment === 'pending' ? 'white' : '#334155',
                    border: streetSegment === 'pending' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Pending ({pendingStreets.length})
                </button>
                <button
                  onClick={() => setStreetSegment('done')}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: streetSegment === 'done' ? '#10b981' : 'white',
                    color: streetSegment === 'done' ? 'white' : '#334155',
                    border: streetSegment === 'done' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Completed ({completedStreets.length})
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={toggleStreetList}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: streetListExpanded ? '#3b82f6' : 'white',
                    color: streetListExpanded ? 'white' : '#334155',
                    border: streetListExpanded ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {streetListExpanded
                    ? `Collapse streets (${streetTotal}) \u25b4`
                    : `Expand streets (${streetTotal}) \u25be`}
                </button>
                {selectedStreet && (
                  <button
                    onClick={() => toggleStreetSelection(selectedStreet)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                    }}
                  >
                    Clear selected street
                  </button>
                )}
              </div>

              {streetListExpanded && (
                <>
                  <input
                    type="text"
                    value={streetSearch}
                    placeholder="Search streets..."
                    onChange={(e) => setStreetSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      marginBottom: "8px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      color: "#334155",
                      backgroundColor: "white",
                    }}
                  />
                  {streetSegment === 'done' ? (
                    completedStreets.length === 0 ? (
                      <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
                        No completed streets yet. Mark a street complete to see it here.
                      </p>
                    ) : (
                      completedStreets.map((e, i) => (
                        <div
                          key={e.street}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            marginBottom: "6px",
                            backgroundColor: i % 2 ? '#f8fafc' : '#ffffff',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span><span style={{ color: '#10b981' }}>{'\u2713'}</span> {e.street}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {e.liked_count > 0 && (
                              <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                                {e.liked_count} liked
                              </span>
                            )}
                            <button
                              onClick={() => undoStreetComplete(e.street)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                              }}
                            >
                              Undo
                            </button>
                          </span>
                        </div>
                      ))
                    )
                  ) : streetLoading && streetItems.length === 0 ? (
                    <div>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            height: "38px",
                            marginBottom: "6px",
                            borderRadius: "8px",
                            background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)",
                            backgroundSize: "400% 100%",
                            animation: "shimmer 1.4s ease infinite",
                          }}
                        />
                      ))}
                    </div>
                  ) : pendingStreets.filter((s) => !streetQuery || s.street.toLowerCase().includes(streetQuery)).length === 0 ? (
                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
                      {streetLoading ? 'Loading streets...' : 'No streets found for this suburb yet.'}
                    </p>
                  ) : (
                    pendingStreets
                      .filter((s) => !streetQuery || s.street.toLowerCase().includes(streetQuery))
                      .map((s, i) => (
                        <div
                          key={s.street}
                          onClick={() => toggleStreetSelection(s.street)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            marginBottom: "6px",
                            backgroundColor: selectedStreet === s.street ? '#3b82f6' : (i % 2 ? '#f8fafc' : '#ffffff'),
                            color: selectedStreet === s.street ? '#ffffff' : '#334155',
                            border: selectedStreet === s.street ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: selectedStreet === s.street ? '600' : '400',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{i + 1}. {s.street}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                              {s.count} {s.count === 1 ? 'address' : 'addresses'}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); markStreetComplete(s.street); }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                              }}
                            >
                              {'\u2713 Done'}
                            </button>
                          </span>
                        </div>
                      ))
                  )}
                  {streetLoading && streetItems.length > 0 && (
                    <p style={{ marginTop: "8px", textAlign: "center", color: "#64748b", fontSize: "0.8rem" }}>
                      Loading more streets...
                    </p>
                  )}
                  {!streetLoading && !streetQuery && streetNextOffset != null && (
                    <button
                      onClick={() => loadStreetList('append')}
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginTop: "6px",
                        backgroundColor: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: "500",
                      }}
                    >
                      Show more streets
                    </button>
                  )}
                </>
              )}

              {selectedStreet && (
                <p style={{ margin: "10px 0 0", color: "#334155", fontSize: "0.8rem" }}>
                  {streetAddressLoading
                    ? `Loading addresses for ${selectedStreet}...`
                    : `${streetAddresses.length} ${streetAddresses.length === 1 ? 'address' : 'addresses'} on ${selectedStreet}`}
                </p>
              )}

              {selectedStreet && !streetAddressLoading && streetProgress[selectedStreet]?.status === 'completed' && (
                <p style={{ margin: "6px 0 0", color: "#047857", fontSize: "0.8rem" }}>
                  {'\u2713'} This street is completed.
                </p>
              )}

              {selectedStreet && !streetAddressLoading && (
                <button
                  onClick={() => markStreetComplete(selectedStreet)}
                  style={{
                    width: "100%",
                    padding: '9px 14px',
                    marginTop: '10px',
                    backgroundColor: streetProgress[selectedStreet]?.status === 'completed' ? '#10b981' : '#047857',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {'\u2713'} Complete this street & go to the next {'\u2192'}
                </button>
              )}

            </div>
          )}

          {filters.suburb && (
            <button
              onClick={handleApplyStreet}
              style={{
                padding: '8px 18px',
                marginTop: '12px',
                backgroundColor: streetModeApplied ? '#3b82f6' : 'white',
                color: streetModeApplied ? 'white' : '#4a5568',
                border: streetModeApplied ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: streetModeApplied ? '600' : '500',
                transition: 'all 0.2s ease',
              }}
            >
              {streetModeApplied ? '\u2713 Applied by street (click to cancel)' : 'Apply'}
            </button>
          )}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Status
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { setShowLikedOnly(v => { if (!v) { setShowPendingOnly(false); setShowSentOnly(false); setShowUnselectedOnly(false); } return !v; }); }}
              style={{
                padding: '8px 18px',
                backgroundColor: showLikedOnly ? '#ef4444' : 'white',
                color: showLikedOnly ? 'white' : '#4a5568',
                border: showLikedOnly ? '2px solid #ef4444' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: showLikedOnly ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: showLikedOnly ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!showLikedOnly) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }
              }}
              onMouseLeave={(e) => {
                if (!showLikedOnly) {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }
              }}
            >
              {showLikedOnly ? '\u2665 Liked' : '\u2661 Liked'}
            </button>
            {showLikedOnly && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#718096' }}>
                {totalProperties} liked
              </span>
            )}
            {showPendingOnly && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#718096' }}>
                {totalProperties} pending
              </span>
            )}
            {showSentOnly && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#718096' }}>
                {totalProperties} sent
              </span>
            )}
            {showUnselectedOnly && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#718096' }}>
                {totalProperties} unselected
              </span>
            )}
            <button
              onClick={() => { setShowPendingOnly(v => { if (!v) { setShowLikedOnly(false); setShowSentOnly(false); setShowUnselectedOnly(false); } return !v; }); }}
              style={{
                padding: '8px 18px',
                backgroundColor: showPendingOnly ? '#3b82f6' : 'white',
                color: showPendingOnly ? 'white' : '#4a5568',
                border: showPendingOnly ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: showPendingOnly ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: showPendingOnly ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
              }}
            >
              {showPendingOnly ? 'Pending' : 'Pending'}
            </button>
            <button
              onClick={() => { setShowSentOnly(v => { if (!v) { setShowLikedOnly(false); setShowPendingOnly(false); setShowUnselectedOnly(false); } return !v; }); }}
              style={{
                padding: '8px 18px',
                backgroundColor: showSentOnly ? '#7c3aed' : 'white',
                color: showSentOnly ? 'white' : '#4a5568',
                border: showSentOnly ? '2px solid #7c3aed' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: showSentOnly ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: showSentOnly ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none',
              }}
            >
              {showSentOnly ? 'Sent' : 'Sent'}
            </button>
            <button
              onClick={() => { setShowUnselectedOnly(v => { if (!v) { setShowLikedOnly(false); setShowPendingOnly(false); setShowSentOnly(false); } return !v; }); }}
              style={{
                padding: '8px 18px',
                backgroundColor: showUnselectedOnly ? '#10b981' : 'white',
                color: showUnselectedOnly ? 'white' : '#4a5568',
                border: showUnselectedOnly ? '2px solid #10b981' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: showUnselectedOnly ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: showUnselectedOnly ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
              }}
            >
              {showUnselectedOnly ? 'Unselected' : 'Unselected'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
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
                  backgroundColor: lastSoldPreset === preset ? (preset === '5-15' ? '#f59e0b' : '#3b82f6') : 'white',
                  color: lastSoldPreset === preset ? 'white' : '#4a5568',
                  border: lastSoldPreset === preset ? (preset === '5-15' ? '2px solid #f59e0b' : '2px solid #3b82f6') : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: lastSoldPreset === preset ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: lastSoldPreset === preset ? (preset === '5-15' ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.3)') : 'none',
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
            {lastSoldPreset !== 'none' && lastSoldPreset !== 'all' && (
              <>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "500", color: "#718096", marginBottom: "4px" }}>
                    Min Years
                  </label>
                  <input
                    type="number"
                    value={filters.last_sold_min_years}
                    onChange={(e) => { setLastSoldPreset(''); handleFilterChange("last_sold_min_years", e.target.value); }}
                    min="0"
                    placeholder="0"
                    style={{
                      width: "90px",
                      padding: "8px 14px",
                      border: "2px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      backgroundColor: "white",
                      color: "#2D3748",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "500", color: "#718096", marginBottom: "4px" }}>
                    Max Years
                  </label>
                  <input
                    type="number"
                    value={filters.last_sold_max_years}
                    onChange={(e) => { setLastSoldPreset(''); handleFilterChange("last_sold_max_years", e.target.value); }}
                    min="0"
                    placeholder="No Max"
                    style={{
                      width: "90px",
                      padding: "8px 14px",
                      border: "2px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      backgroundColor: "white",
                      color: "#2D3748",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", color: "#4a5568", marginBottom: "8px" }}>
            Built Year
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {(['all', '<5', '5-10', '10-20', '20+'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handleBuildYearPreset(preset)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: buildYearPreset === preset ? (preset === '5-10' ? '#f59e0b' : '#3b82f6') : 'white',
                  color: buildYearPreset === preset ? 'white' : '#4a5568',
                  border: buildYearPreset === preset ? (preset === '5-10' ? '2px solid #f59e0b' : '2px solid #3b82f6') : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: buildYearPreset === preset ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: buildYearPreset === preset ? (preset === '5-10' ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.3)') : 'none',
                }}
                onMouseEnter={(e) => {
                  if (buildYearPreset !== preset) {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (buildYearPreset !== preset) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                {preset === 'all' ? 'All' : preset === '<5' ? '< 5 years' : preset === '5-10' ? '★ 5-10 years' : preset === '10-20' ? '10-20 years' : '20+ years'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Beds
            </label>
            <input
              type="number"
              value={filters.min_bedrooms}
              onChange={(e) => handleFilterChange("min_bedrooms", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "70px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min RV ($)
            </label>
            <input
              type="number"
              value={filters.rv_min}
              onChange={(e) => handleFilterChange("rv_min", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "100px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Max RV ($)
            </label>
            <input
              type="number"
              value={filters.rv_max}
              onChange={(e) => handleFilterChange("rv_max", e.target.value)}
              min="0"
              placeholder="No Max"
              style={{
                width: "100px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Floor (m²)
            </label>
            <input
              type="number"
              value={filters.min_floor_area}
              onChange={(e) => handleFilterChange("min_floor_area", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Min Land (m²)
            </label>
            <input
              type="number"
              value={filters.min_land_area}
              onChange={(e) => handleFilterChange("min_land_area", e.target.value)}
              min="0"
              placeholder="0"
              style={{
                width: "90px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: "#2D3748",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
              Market Premium
            </label>
            <select
              value={filters.market_premium}
              onChange={(e) => handleFilterChange("market_premium", e.target.value)}
              style={{
                width: "110px",
                padding: "7px 10px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.9rem",
                backgroundColor: "white",
                color: filters.market_premium ? "#2D3748" : "#9ca3af",
                cursor: "pointer",
              }}
            >
              <option value="">Any</option>
              <option value="100">Sale &gt; RV</option>
              <option value="110">Sale &gt; 110% RV</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              style={{
                padding: "7px 16px",
                backgroundColor: "white",
                color: "#3b82f6",
                border: "2px dashed #93c5fd",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "600",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#93c5fd'; }}
            >
              {showMoreFilters ? "− Hide" : "+ More"}
            </button>
          </div>
        </div>

        {showMoreFilters && (
          <div style={{
            marginBottom: "16px",
            padding: "16px",
            backgroundColor: "#fafafa",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Bedrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bedrooms}
                  onChange={(e) => handleFilterChange("max_bedrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Min Bathrooms
                </label>
                <input
                  type="number"
                  value={filters.min_bathrooms}
                  onChange={(e) => handleFilterChange("min_bathrooms", e.target.value)}
                  min="0"
                  placeholder="0"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Bathrooms
                </label>
                <input
                  type="number"
                  value={filters.max_bathrooms}
                  onChange={(e) => handleFilterChange("max_bathrooms", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Min Car Spaces
                </label>
                <input
                  type="number"
                  value={filters.min_car_spaces}
                  onChange={(e) => handleFilterChange("min_car_spaces", e.target.value)}
                  min="0"
                  placeholder="0"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Car Spaces
                </label>
                <input
                  type="number"
                  value={filters.max_car_spaces}
                  onChange={(e) => handleFilterChange("max_car_spaces", e.target.value)}
                  min="0"
                  placeholder="10"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Max Land (m²)
                </label>
                <input
                  type="number"
                  value={filters.max_land_area}
                  onChange={(e) => handleFilterChange("max_land_area", e.target.value)}
                  min="0"
                  placeholder="No Max"
                  style={{
                    width: "80px",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Region
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    cursor: "pointer",
                  }}
                >
                  <option value="Auckland">Auckland</option>
                  <option value="Wellington">Wellington</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  City / District
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    cursor: "pointer",
                  }}
                >
                  {(REGION_CITIES[filters.region as keyof typeof REGION_CITIES] || []).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "500", color: "#4a5568", marginBottom: "4px" }}>
                  Suburb
                </label>
                <select
                  value={filters.suburb}
                  onChange={(e) => handleFilterChange("suburb", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                    color: "#2D3748",
                    cursor: "pointer",
                  }}
                >
                  {sortedSuburbs.map((suburb) => (
                    <option key={suburb} value={suburb}>
                      {suburb}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button
            onClick={handleClearFilters}
            style={{
              padding: "10px 20px",
              backgroundColor: "#e2e8f0",
              color: "#4a5568",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.9rem",
              transition: "all 0.2s",
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px", marginBottom: "12px", padding: "12px 16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: "0.9rem", color: "#4a5568" }}>
          {totalProperties === 0
            ? 'Displaying 0 of 0 properties'
            : isClassic
              ? `Displaying ${Math.max(1, (currentPage - 1) * pageSize + 1)} to ${Math.min(currentPage * pageSize, totalProperties)} of ${totalProperties} properties`
              : `Displaying 1 to ${displayProperties.length} of ${totalProperties} properties`}
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
        <div style={{ display: "inline-flex", borderRadius: "10px", overflow: "hidden", border: "2px solid #e2e8f0" }}>
          <button
            onClick={() => setViewMode('card')}
            style={{
              padding: "8px 18px",
              backgroundColor: viewMode === 'card' ? '#3b82f6' : 'white',
              color: viewMode === 'card' ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: "8px 18px",
              backgroundColor: viewMode === 'list' ? '#3b82f6' : 'white',
              color: viewMode === 'list' ? 'white' : '#4a5568',
              border: 'none',
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
          >
            List
          </button>
        </div>
      </div>

      {isClassic && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
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
              style={{
                width: "52px",
                padding: "4px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#2D3748",
                textAlign: "center",
                outline: "none",
                MozAppearance: "textfield",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≫</button>
        </div>
      )}

      {isError && (
        <div style={{
          padding: "16px",
          marginBottom: "24px",
          backgroundColor: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          color: "#991b1b",
          textAlign: "center"
        }}>
          Error loading properties: {error?.message || "Unknown error occurred"}
        </div>
      )}

      {streetModeOn && !selectedStreet && (
        <div style={{ padding: "16px", marginBottom: "24px", backgroundColor: "#eff6ff", border: "1px dashed #93c5fd", borderRadius: "8px", color: "#1e40af", textAlign: "center" }}>
          Select a street from the <strong>Filter by Street</strong> panel to see its addresses ordered by walking route.
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="space-y-4" style={{ marginBottom: "32px", opacity: isClassic ? (classicFetching && !isFetchingNextPage ? 0.6 : 1) : (isFetching && !isFetchingNextPage ? 0.6 : 1), transition: "opacity 0.2s ease-in-out" }}>
          {groupedBySuburb.map(({ suburb, streets, totalCount }) => (
            <div key={suburb} className="border border-slate-200 rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
              <div className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📂</span>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">{suburb}</div>
                    <div className="text-xs text-slate-500">
                      {streets.length} {streets.length === 1 ? 'street' : 'streets'} · {totalCount} {totalCount === 1 ? 'property' : 'properties'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {streets.map(({ street, properties: streetProps }) => {
                  const streetKey = `${suburb}::${street}`;
                  const isCollapsed = collapsedStreets.has(streetKey);
                  return (
                    <div key={street} className="bg-white">
                      <button
                        onClick={() => toggleStreet(suburb, street)}
                        className="w-full px-4 py-2 border-b border-slate-100 flex items-center justify-between hover:bg-slate-200 transition-colors"
                        style={{ backgroundColor: isCollapsed ? '#f1f5f9' : '#f8fafc' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📍</span>
                          <span className="font-medium text-slate-700">{street}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">
                            {streetProps.length} {streetProps.length === 1 ? 'address' : 'addresses'}
                          </span>
                          <span className="text-slate-400">{isCollapsed ? '▶' : '▼'}</span>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="divide-y divide-slate-50">
                          {streetProps.map((prop) => {
                            return (
                              <div key={`${prop.id}-${prop.address}`} className="pl-10 pr-4 py-2.5 hover:bg-blue-50 transition-colors">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="font-medium text-slate-800">
                                    {prop.address}
                                    {extractHouseNumber(prop.address).unitNumber > 0 && ' (Unit)'}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleLike(prop); }}
                                    style={{
                                      width: '30px', height: '30px', borderRadius: '50%',
                                      background: (showLikedOnly || likedPropertyIds.has(prop.id)) ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.85)',
                                      border: '1px solid #e2e8f0', cursor: 'pointer', display: 'inline-flex',
                                      alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                                    }}
                                    title={(showLikedOnly || likedPropertyIds.has(prop.id)) ? 'Unlike' : 'Like'}
                                  >
                                    {(showLikedOnly || likedPropertyIds.has(prop.id)) ? '\u2764' : '\u2661'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleUnselect(prop); }}
                                    style={{
                                      marginLeft: '6px', padding: '6px 10px', borderRadius: '8px',
                                      background: 'white', border: '1px solid #e2e8f0', color: '#4a5568', cursor: 'pointer',
                                      fontSize: '0.8rem', fontWeight: 600,
                                    }}
                                    title="Unselect (clear outreach statuses)"
                                  >
                                    Unselect
                                  </button>
                                  <span className="text-xs text-slate-500">
                                    {[(prop.bedrooms != null ? `${prop.bedrooms} bd` : null),
                                    (prop.bathrooms != null ? `${prop.bathrooms} ba` : null),
                                    (prop.garages != null ? `${prop.garages} car` : null),
                                    (prop.land_area ? `${prop.land_area} m²` : null)].filter(Boolean).join(' · ') || '—'}
                                  </span>
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
          ))}
          {(isFetchingNextPage || (classicFetching && isClassic)) && Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-row-${i}`} className="border border-slate-200 rounded-lg p-4 animate-pulse" style={{ backgroundColor: 'white' }}>
              <SkeletonBlock className="h-4 w-48 mb-2" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
          ))}
          {!isClassic && hasNextPage && !isFetchingNextPage && (
            <div ref={lastPropertyElementRef} style={{ height: '1px' }} />
          )}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "30px",
          marginBottom: "32px",
          opacity: isClassic ? (classicFetching && !isFetchingNextPage ? 0.6 : 1) : (isFetching && !isFetchingNextPage ? 0.6 : 1),
          transition: "opacity 0.2s ease-in-out",
        }}>
          {displayProperties.map((property, index) => {
            const isLast = index === displayProperties.length - 1;
            return (
              <div key={`${property.id}-${index}`} ref={(!isClassic && isLast) ? lastPropertyElementRef : null}>
                <PropertyCard
                  property={property}
                  isLiked={showLikedOnly || likedPropertyIds.has(property.id)}
                  onToggleLike={handleToggleLike}
                />
              </div>
            );
          })}
          {(isFetchingNextPage || (classicFetching && isClassic)) && Array.from({ length: pageSize }).map((_, i) => (
            <SkeletonPropertyCard key={`skel-${i}`} />
          ))}
        </div>
      )}

      {isClassic && displayProperties.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
          <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
            {Math.max(1, (currentPage - 1) * pageSize + 1)}–{Math.min(currentPage * pageSize, totalProperties)} of {totalProperties}
          </span>
          <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>|</span>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≪</button>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage <= 1 ? '#f8fafc' : 'white', color: currentPage <= 1 ? '#cbd5e1' : '#4a5568',
              cursor: currentPage <= 1 ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
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
              style={{
                width: "52px",
                padding: "4px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#2D3748",
                textAlign: "center",
                outline: "none",
                MozAppearance: "textfield",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              min={1}
              max={totalPages}
            />{' '}
            of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >›</button>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}
            style={{
              padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
              backgroundColor: currentPage >= totalPages ? '#f8fafc' : 'white', color: currentPage >= totalPages ? '#cbd5e1' : '#4a5568',
              cursor: currentPage >= totalPages ? 'default' : 'pointer', fontSize: "0.85rem", fontWeight: "600",
              transition: "all 0.15s", lineHeight: "1",
            }}
            onMouseEnter={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { if (currentPage < totalPages) { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
          >≫</button>
        </div>
      )}

      {!isClassic && !hasNextPage && displayProperties.length > 0 && !isFetchingNextPage && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          color: "#718096",
          fontSize: "0.95rem",
          fontWeight: "500",
        }}>
          No more properties to load
        </div>
      )}

      {!isClassic && !hasNextPage && displayProperties.length > 0 && (
        <div style={{
          textAlign: "center",
          padding: "30px",
          color: "#718096",
          fontSize: "0.95rem",
        }}>
          You{"'"}ve reached the end! No more properties to load.
        </div>
      )}

      {/* Empty State */}
      {displayProperties.length === 0 && !isLoading && !classicLoading && (
        <div style={{
          textAlign: "center",
          padding: "80px 30px",
          color: "#718096",
          backgroundColor: "white",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
        }}>
          <h3 style={{ fontSize: "1.8rem", marginBottom: "16px", color: "#2D3748" }}>
            No properties found
          </h3>
          <p style={{ fontSize: "1.1rem" }}>Try adjusting your search criteria</p>
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
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2D3748', marginBottom: '24px' }}>
              Edit Property
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'suburb', label: 'Suburb', type: 'text' },
                { key: 'city', label: 'City', type: 'text' },
                { key: 'region', label: 'Region', type: 'text' },
                { key: 'postcode', label: 'Postcode', type: 'text' },
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
                <p className="text-xs text-slate-400 mt-0.5">{convertingProperty.address}</p>
              </div>
              <button onClick={() => setConvertModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Owner Name</label>
                <input type="text" value={convertForm.owner_name}
                  onChange={e => setConvertForm(p => ({ ...p, owner_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Owner name" />
              </div>
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g., Owner called about appraisal" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
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

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
