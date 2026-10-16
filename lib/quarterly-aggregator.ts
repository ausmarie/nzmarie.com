import type { MonthlyDataPoint } from './market-data-aggregator';

function quarterKeyParts(key: string): { year: number; quarter: number } | null {
  const m = key.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

function previousQuarterKey(key: string): string | null {
  const p = quarterKeyParts(key);
  if (!p) return null;
  return p.quarter === 1 ? `${p.year - 1}-Q4` : `${p.year}-Q${p.quarter - 1}`;
}

function sameQuarterPrevYearKey(key: string): string | null {
  const p = quarterKeyParts(key);
  if (!p) return null;
  return `${p.year - 1}-Q${p.quarter}`;
}

function pctChange(cur: number | null | undefined, base: number | null | undefined): number | null {
  if (cur == null || base == null || base === 0) return null;
  return Math.round(((cur - base) / base) * 10000) / 100;
}

export function aggregateToQuarterly(monthly: MonthlyDataPoint[]): MonthlyDataPoint[] {
  const groups = new Map<string, MonthlyDataPoint[]>();

  for (const m of monthly) {
    const [year, month] = m.period.split('-');
    const q = Math.ceil(parseInt(month) / 3);
    const key = `${year}-Q${q}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const result: MonthlyDataPoint[] = [];

  for (const [key, months] of groups) {
    const suburbNames = new Set<string>();
    for (const m of months) {
      for (const sn of Object.keys(m.suburbs)) {
        suburbNames.add(sn);
      }
    }

    const suburbs: MonthlyDataPoint['suburbs'] = {};
    const toNum = (v: unknown): number => Number(v);
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + toNum(b), 0) / arr.length) : null;
    const sum = (arr: number[]) => arr.reduce((a, b) => a + toNum(b), 0);
    const avgField = (arr: (number | null | undefined)[]) => {
      const nums = arr.filter((v): v is number => v != null);
      return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + toNum(b), 0) / nums.length) : null;
    };

    for (const sn of suburbNames) {
      const medians: number[] = [];
      let salesSum = 0;
      const days: number[] = [];
      const priceDiffMom: (number | null | undefined)[] = [];
      const priceDiff1yr: (number | null | undefined)[] = [];
      const medianListPrices: (number | null | undefined)[] = [];
      const saleToValuation: (number | null | undefined)[] = [];
      const listToValuation: (number | null | undefined)[] = [];
      const totalVolumes: number[] = [];
      const medianPrice1yr: (number | null | undefined)[] = [];
      const medianPrice3yrs: (number | null | undefined)[] = [];
      const priceDiff3yrs: (number | null | undefined)[] = [];
      const housePriceIndexes: (number | null | undefined)[] = [];

      for (const m of months) {
        const sd = m.suburbs[sn];
        if (sd) {
          if (sd.median != null) medians.push(Number(sd.median));
          salesSum += Number(sd.sales);
          if (sd.days != null) days.push(Number(sd.days));
          priceDiffMom.push(sd.priceDiffMomPct);
          priceDiff1yr.push(sd.priceDiff1yrPct);
          medianListPrices.push(sd.medianListPrice);
          saleToValuation.push(sd.saleToValuationPct);
          listToValuation.push(sd.listToValuationPct);
          if (sd.totalVolume != null) totalVolumes.push(sd.totalVolume);
          medianPrice1yr.push(sd.medianPrice1yrPrior);
          medianPrice3yrs.push(sd.medianPrice3yrsPrior);
          priceDiff3yrs.push(sd.priceDiff3yrsPct);
          housePriceIndexes.push(sd.housePriceIndex);
        }
      }

      suburbs[sn] = {
        median: avg(medians),
        sales: salesSum,
        days: avg(days),
        priceDiffMomPct: avgField(priceDiffMom),
        priceDiff1yrPct: avgField(priceDiff1yr),
        medianListPrice: avgField(medianListPrices),
        saleToValuationPct: avgField(saleToValuation),
        listToValuationPct: avgField(listToValuation),
        totalVolume: totalVolumes.length > 0 ? sum(totalVolumes) : null,
        medianPrice1yrPrior: avgField(medianPrice1yr),
        medianPrice3yrsPrior: avgField(medianPrice3yrs),
        priceDiff3yrsPct: avgField(priceDiff3yrs),
        housePriceIndex: avgField(housePriceIndexes),
      };
    }

    const cityMedians = months.map(m => m.cityMedian).filter((v): v is number => v !== null);
    const cityDays = months.map(m => m.cityDays).filter((v): v is number => v !== null);

    const cityDetailAgs: (number | null | undefined)[] = [];
    const cityDetailSales: number[] = [];
    const cityDetailDays: (number | null | undefined)[] = [];
    const cityDetailMom: (number | null | undefined)[] = [];
    const cityDetail1yr: (number | null | undefined)[] = [];
    const cityDetailListPrice: (number | null | undefined)[] = [];
    const cityDetailS2V: (number | null | undefined)[] = [];
    const cityDetailL2V: (number | null | undefined)[] = [];
    const cityDetailVolume: number[] = [];
    const cityDetail1yrPrior: (number | null | undefined)[] = [];
    const cityDetail3yrsPrior: (number | null | undefined)[] = [];
    const cityDetail3yrPct: (number | null | undefined)[] = [];
    const cityDetailHpi: (number | null | undefined)[] = [];
    for (const m of months) {
      const cd = m.cityDetail;
      if (cd) {
        if (cd.median != null) cityDetailAgs.push(cd.median);
        cityDetailSales.push(Number(cd.sales));
        if (cd.days != null) cityDetailDays.push(cd.days);
        cityDetailMom.push(cd.priceDiffMomPct);
        cityDetail1yr.push(cd.priceDiff1yrPct);
        cityDetailListPrice.push(cd.medianListPrice);
        cityDetailS2V.push(cd.saleToValuationPct);
        cityDetailL2V.push(cd.listToValuationPct);
        if (cd.totalVolume != null) cityDetailVolume.push(cd.totalVolume);
        cityDetail1yrPrior.push(cd.medianPrice1yrPrior);
        cityDetail3yrsPrior.push(cd.medianPrice3yrsPrior);
        cityDetail3yrPct.push(cd.priceDiff3yrsPct);
        cityDetailHpi.push(cd.housePriceIndex);
      }
    }
    const aggDetail: MonthlyDataPoint['cityDetail'] = cityDetailSales.length > 0 ? {
      median: avg(cityDetailAgs.filter((v): v is number => v != null)),
      sales: cityDetailSales.reduce((a, b) => a + Number(b), 0),
      days: avg(cityDetailDays.filter((v): v is number => v != null)),
      priceDiffMomPct: avgField(cityDetailMom),
      priceDiff1yrPct: avgField(cityDetail1yr),
      medianListPrice: avgField(cityDetailListPrice),
      saleToValuationPct: avgField(cityDetailS2V),
      listToValuationPct: avgField(cityDetailL2V),
      totalVolume: cityDetailVolume.length > 0 ? cityDetailVolume.reduce((a, b) => a + Number(b), 0) : null,
      medianPrice1yrPrior: avgField(cityDetail1yrPrior),
      medianPrice3yrsPrior: avgField(cityDetail3yrsPrior),
      priceDiff3yrsPct: avgField(cityDetail3yrPct),
      housePriceIndex: avgField(cityDetailHpi),
    } : null;

    result.push({
      period: key,
      periodRaw: key,
      cityMedian: avg(cityMedians),
      citySales: months.reduce((s, m) => s + Number(m.citySales), 0),
      cityDays: avg(cityDays),
      cityDetail: aggDetail,
      suburbs,
    });
  }

  const sorted = result.sort((a, b) => a.period.localeCompare(b.period));

  // Quarter-over-quarter (QoQ) and year-over-year (YoY) must be derived from
  // the aggregated quarterly medians — averaging the monthly REINZ diff
  // columns is not meaningful for a quarterly row. When the comparison
  // quarter is outside the supplied range, QoQ is null and YoY falls back to
  // the monthly-average value.
  const byPeriod = new Map(sorted.map(r => [r.period, r]));
  for (const row of sorted) {
    const prevRow = previousQuarterKey(row.period) ? byPeriod.get(previousQuarterKey(row.period)!) : undefined;
    const yearRow = sameQuarterPrevYearKey(row.period) ? byPeriod.get(sameQuarterPrevYearKey(row.period)!) : undefined;
    for (const sn of Object.keys(row.suburbs)) {
      const sd = row.suburbs[sn];
      row.suburbs[sn] = {
        ...sd,
        priceDiffMomPct: pctChange(sd.median, prevRow?.suburbs[sn]?.median),
        priceDiff1yrPct: pctChange(sd.median, yearRow?.suburbs[sn]?.median) ?? sd.priceDiff1yrPct ?? null,
      };
    }
    if (row.cityDetail) {
      row.cityDetail = {
        ...row.cityDetail,
        priceDiffMomPct: pctChange(row.cityDetail.median, prevRow?.cityDetail?.median),
        priceDiff1yrPct: pctChange(row.cityDetail.median, yearRow?.cityDetail?.median) ?? row.cityDetail.priceDiff1yrPct ?? null,
      };
    }
  }

  return sorted;
}
