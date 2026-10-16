'use client';

import React, { useState, useMemo } from 'react';
import type { MonthlyDataPoint, SuburbDetail } from '@/lib/market-data-aggregator';
import { aggregateToQuarterly } from '@/lib/quarterly-aggregator';

const SUBURB_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function getSuburbColor(index: number): string {
  return SUBURB_COLORS[index % SUBURB_COLORS.length];
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return `$${value.toLocaleString('en-NZ')}`;
}

function formatShortPrice(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString('en-NZ')}`;
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatPctShort(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return `${value.toFixed(0)}%`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return value.toLocaleString('en-NZ');
}

function priceGapDetail(list: number | null | undefined, sale: number | null | undefined): { gap: number; pct: number } | null {
  if (list == null || sale == null || sale === 0) return null;
  return { gap: list - sale, pct: Math.round(((list - sale) / sale) * 100) };
}

function daysHighlight(days: number | null | undefined): 'normal' | 'warn' | 'alert' {
  if (days == null) return 'normal';
  if (days > 60) return 'alert';
  if (days > 40) return 'warn';
  return 'normal';
}

function valuationHighlight(ratio: number | null | undefined): 'below' | 'normal' | 'above' {
  if (ratio == null) return 'normal';
  if (ratio < 95) return 'below';
  if (ratio > 105) return 'above';
  return 'normal';
}

interface AIInsight {
  landlord: string;
  buyer: string;
  market: string;
}

const EMPTY_INSIGHT: AIInsight = { landlord: '', buyer: '', market: '' };

function generateInsight(period: string, sd: SuburbDetail | null | undefined, periodWord: 'month' | 'quarter' = 'month'): AIInsight {
  if (!sd) return EMPTY_INSIGHT;

  const median = sd.median;
  const mom = sd.priceDiffMomPct;
  const yoy = sd.priceDiff1yrPct;
  const listPrice = sd.medianListPrice;
  const valRatio = sd.saleToValuationPct;
  const listValRatio = sd.listToValuationPct;
  const days = sd.days;
  const sales = sd.sales;
  const volume = sd.totalVolume;
  const yr3Pct = sd.priceDiff3yrsPct;

  const gap = priceGapDetail(listPrice, median);
  const valTip = valRatio != null ? (valRatio < 100 ? `below valuation (${valRatio}%)` : `above valuation (${valRatio}%)`) : 'at market';

  let landlord = '';
  if (listValRatio != null && listValRatio > 100) {
    landlord = `Your property is listed at ${listValRatio}% of valuation — ${listPrice ? formatPrice(listPrice) : 'competitive'}. `;
    if (yr3Pct != null && yr3Pct > 0) {
      landlord += `With ${formatPct(yr3Pct)} growth over 3 years, now is an ideal time to list before the next surge.`;
    } else {
      landlord += 'Consider adjusting price to align with recent market comps for a faster sale.';
    }
  } else if (valRatio != null && valRatio < 95) {
    landlord = `Sales are trending ${valTip}. Current median ${formatPrice(median)}. `;
    if (yoy != null && yoy > 0) {
      landlord += `Despite ${formatPct(yoy)} yearly growth, buyers are negotiating hard. Price competitively to attract multiple offers.`;
    } else {
      landlord += 'Consider staging improvements to justify a higher asking price.';
    }
  } else {
    landlord = `Market is balanced with median at ${formatPrice(median)}. `;
    if (mom != null) landlord += `Prices ${mom >= 0 ? 'edging up' : 'softening'} ${formatPct(mom)} ${periodWord}-on-${periodWord}. `;
    landlord += 'Highlight your property\'s unique features to stand out.';
  }

  let buyer = '';
  if (days != null && days > 50) {
    buyer = `Days on market at ${days} — you have negotiating power. `;
    if (gap) buyer += `List price exceeds sold by ${formatPrice(gap.gap)} (${gap.pct}%). Offer below asking. `;
    if (mom != null && mom < 0) buyer += `Prices dropped ${formatPct(mom)} this ${periodWord} — act quickly before the market rebounds.`;
    else buyer += 'Sellers are motivated. Start with a 5-10% below-asking offer.';
  } else if (sales != null && sales < 5) {
    buyer = `Only ${sales} sales this period — low inventory means less competition. `;
    if (days != null) buyer += `Properties sell in ~${days} days. Be ready with pre-approval. `;
    buyer += 'Move fast when you find the right property.';
  } else {
    buyer = `Healthy market with ${sales ?? 'steady'} sales and ~${days ?? 'standard'} days on market. `;
    if (mom != null && mom > 0) buyer += `Prices up ${formatPct(mom)} this ${periodWord} — don't wait. `;
    buyer += 'Compare recent sales to ensure fair value before offering.';
  }

  let market = '';
  if (volume != null && volume > 10000000) {
    market = `Total volume reached ${formatShortPrice(volume)} — strong economic activity in this area. `;
  } else if (volume != null) {
    market = `Total volume at ${formatShortPrice(volume)} — moderate market activity. `;
  } else {
    market = '';
  }
  if (yoy != null) {
    market += `Prices ${yoy >= 0 ? 'up' : 'down'} ${formatPct(yoy)} year-on-year. `;
  }
  if (valRatio != null) {
    market += `Sale-to-valuation ratio at ${valRatio}% indicates a ${valRatio < 100 ? 'buyer-favorable' : 'seller-favorable'} market.`;
  }

  return { landlord: landlord.trim(), buyer: buyer.trim(), market: market.trim() };
}

interface Props {
  monthlyData: MonthlyDataPoint[];
  dataMode: 'monthly' | 'quarterly';
  onModeChange: (mode: 'monthly' | 'quarterly') => void;
  activeFocusSuburb: string;
  availableSuburbs: string[];
  onFocusChange: (suburb: string) => void;
}

export default function MonthlyDataTable({
  monthlyData,
  dataMode,
  onModeChange,
  activeFocusSuburb,
  availableSuburbs,
  onFocusChange,
}: Props) {
  const isDistrict = activeFocusSuburb === 'North Shore City';
  const activeData = useMemo(
    () => dataMode === 'monthly' ? monthlyData : aggregateToQuarterly(monthlyData),
    [monthlyData, dataMode]
  );
  const sortedData = useMemo(() => [...activeData].reverse(), [activeData]);

  const [selectedRow, setSelectedRow] = useState<MonthlyDataPoint | null>(null);

  const insight = useMemo(() => {
    if (!selectedRow) return null;
    const sd = isDistrict ? selectedRow.cityDetail : selectedRow.suburbs[activeFocusSuburb];
    return generateInsight(selectedRow.period, sd, dataMode === 'monthly' ? 'month' : 'quarter');
  }, [selectedRow, activeFocusSuburb, isDistrict, dataMode]);

  const hasDetail = !isDistrict && activeData.length > 0 && activeData.some(d => {
    const sd = d.suburbs[activeFocusSuburb];
    return sd != null && (sd.median != null || sd.sales > 0 || sd.days != null);
  });
  const noDetail = !isDistrict && (activeData.length === 0 || !hasDetail);

  if (activeData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Data</h3>
        <div className="flex items-center justify-center h-[100px] text-gray-400 text-sm">
          No market data yet. Upload a REINZ Excel file above to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Analysis Data</h3>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => onModeChange('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              dataMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onModeChange('quarterly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              dataMode === 'quarterly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Quarterly
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {availableSuburbs.map((s) => {
          const active = activeFocusSuburb === s;
          const color = getSuburbColor(availableSuburbs.indexOf(s));
          return (
            <button
              key={s}
              onClick={() => onFocusChange(s)}
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
          onClick={() => onFocusChange('North Shore City')}
          className={`text-sm font-medium rounded-full px-3 py-1.5 border transition-all ${
            isDistrict
              ? 'bg-[#94A3B8] text-white border-[#94A3B8] shadow-sm'
              : 'text-gray-500 border-gray-300 hover:border-gray-400 bg-white'
          }`}
        >
          North Shore {isDistrict ? '✓' : ''}
        </button>
      </div>

      {noDetail && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
          No detailed data available for {activeFocusSuburb}. Try selecting a different suburb or uploading data.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">Period</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">(Month/Qtr)</div>
              </th>
              <th className="text-right py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">Median Price</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">
                  {dataMode === 'monthly' ? 'MoM / YoY Trend' : 'QoQ / YoY Trend'}
                </div>
              </th>
              <th className="text-right py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">List vs Sold</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">Market Gap %</div>
              </th>
              <th className="text-right py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">Sale / CV %</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">(vs Valuation)</div>
              </th>
              <th className="text-right py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">Volume / Pace</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">Sales | Days</div>
              </th>
              <th className="text-right py-2 px-2 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 tracking-tight leading-tight">Market Size</div>
                <div className="text-xs font-normal text-gray-500 tracking-tight leading-tight">Total Volume</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => {
              const sd = isDistrict ? row.cityDetail : row.suburbs[activeFocusSuburb];
              const gap = sd ? priceGapDetail(sd.medianListPrice, sd.median) : null;
              const dHighlight = sd ? daysHighlight(sd.days) : 'normal';
              const vHighlight = sd ? valuationHighlight(sd.saleToValuationPct) : 'normal';
              const isSelected = selectedRow?.period === row.period;

              return (
                <tr
                  key={row.period}
                  onClick={() => setSelectedRow(isSelected ? null : row)}
                  className={`border-b border-gray-100 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-2.5 px-2 font-medium whitespace-nowrap text-gray-900">{row.period}</td>

            
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="font-semibold text-gray-900">{formatPrice(sd?.median)}</div>
                    <div className="text-xs space-x-1.5">
                      {sd?.priceDiffMomPct != null && (
                        <span className={sd.priceDiffMomPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {dataMode === 'monthly' ? 'MoM' : 'QoQ'} {formatPct(sd.priceDiffMomPct)}
                        </span>
                      )}
                      {sd?.priceDiff1yrPct != null && (
                        <span className={sd.priceDiff1yrPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                          YoY {formatPct(sd.priceDiff1yrPct)}
                        </span>
                      )}
                      {sd?.priceDiffMomPct == null && sd?.priceDiff1yrPct == null && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    {gap ? (
                      <>
                        <div className="text-gray-900">
                          <span className="text-gray-500">List </span>{formatShortPrice(sd?.medianListPrice)}
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-500">Sold </span>{formatShortPrice(sd?.median)}
                          <span className={gap.gap > 0 ? 'text-red-600 ml-1' : 'text-green-600 ml-1'}>
                            ({gap.pct > 0 ? '+' : ''}{gap.pct}%)
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    {sd?.saleToValuationPct != null ? (
                      <span
                        className={`font-semibold px-2 py-0.5 rounded ${
                          vHighlight === 'below'
                            ? 'bg-orange-100 text-orange-700'
                            : vHighlight === 'above'
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-900'
                        }`}
                      >
                        {formatPctShort(sd.saleToValuationPct)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {sd?.saleToValuationPct != null && sd.saleToValuationPct < 100 && (
                      <div className="text-xs text-orange-600 mt-0.5">Buyer market</div>
                    )}
                  </td>

                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="text-gray-900">{sd?.sales != null ? formatNumber(sd.sales) : '—'}</div>
                    <div className={`text-xs ${
                      dHighlight === 'alert' ? 'text-red-600 font-semibold' :
                      dHighlight === 'warn' ? 'text-orange-600' : 'text-gray-500'
                    }`}>
                      {sd?.days != null ? `${sd.days} days` : '—'}
                    </div>
                  </td>

                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    {sd?.totalVolume != null ? (
                      <span className="font-semibold text-gray-900">{formatShortPrice(sd.totalVolume)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRow && insight && (insight.landlord || insight.buyer || insight.market) && (
        <div className="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-blue-900">💡 AI Copilot — {selectedRow.period}</h4>
            <button
              onClick={() => setSelectedRow(null)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              Close
            </button>
          </div>
          <div className="space-y-3 text-sm">
            {insight.landlord && (
              <div>
                <div className="font-semibold text-gray-800 mb-1">📞 Landlord Script</div>
                <p className="text-gray-700 leading-relaxed">{insight.landlord}</p>
              </div>
            )}
            {insight.buyer && (
              <div>
                <div className="font-semibold text-gray-800 mb-1">🏠 Buyer Script</div>
                <p className="text-gray-700 leading-relaxed">{insight.buyer}</p>
              </div>
            )}
            {insight.market && (
              <div>
                <div className="font-semibold text-gray-800 mb-1">📊 Market Insight</div>
                <p className="text-gray-700 leading-relaxed">{insight.market}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
