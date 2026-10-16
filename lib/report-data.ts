export interface CSVRow {
  [header: string]: string;
}

export interface ReportDef {
  key: string;
  name: string;
  periodText: string;
  months: string[];
  anomalyTitle: string;
  anomalyText: string;
  compareLabel: string;
  comparePriceChange: string;
  comparePriceUp: boolean;
  compareSalesChange: string;
  compareSalesUp: boolean;
  compareDaysChange: string;
  compareDaysUp: boolean;
  data: CSVRow[];
}

export interface TrendRow {
  monthName: string;
  currPrice: number;
  prevPrice: number | null;
  priceDiffPct: string;
  currSales: number;
  prevSales: number;
  salesDiffPct: string;
  currDays: number;
  prevDays: number | null;
  daysDiff: string;
}

export interface ReportMetrics {
  name: string;
  periodText: string;
  totalVolume: number;
  totalSales: number;
  avgDaysToSell: number | "N/A";
  anomalyTitle: string;
  anomalyText: string;
  compareLabel: string;
  comparePriceChange: string;
  comparePriceUp: boolean;
  compareSalesChange: string;
  compareSalesUp: boolean;
  compareDaysChange: string;
  compareDaysUp: boolean;
  trendRows: TrendRow[];
  daysToSellDescription?: string;
}

export const slugMap: Record<string, { suburb: string; version: string }> = {
  "northcross-q1-2026": { suburb: "Northcross", version: "2026-YTD-Q1" },
  "northcross-h2-2025": { suburb: "Northcross", version: "2025-H2" },
  "northcross-ytd-2026": { suburb: "Northcross", version: "2026-YTD-H1" },
};

export function formatCurrency(val: number): string {
  if (isNaN(val) || val === 0) return "N/A";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(val);
}

export function parseCSV(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    return row;
  });
}

const reportDefs: Omit<ReportDef, "data">[] = [
  {
    key: "2025-H2",
    name: "2025 Year-to-Date (H2)",
    periodText: "July – December 2025",
    months: ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"],
    anomalyTitle: "The Gap Fallacy",
    anomalyText:
      "Across the second half of 2025, Northcross achieved a strong performance with $35.0M in total volume. However, automated systems showed significant value gaps (NaNs) during August, October, and December due to lower monthly transaction counts (2-3 sales). AVMs fail to calculate baseline metrics during low-volume months, artificially flatlining valuations when human-vetted demand actually remained stable.",
    compareLabel: "Compared to July 2025 Baseline",
    comparePriceChange: "+17.9%",
    comparePriceUp: true,
    compareSalesChange: "-22.2%",
    compareSalesUp: false,
    compareDaysChange: "-33",
    compareDaysUp: true,
  },
  {
    key: "2026-YTD-Q1",
    name: "2026 Year-to-Date (Q1)",
    periodText: "January – March 2026",
    months: ["2026-01", "2026-02", "2026-03"],
    anomalyTitle: "The Product Mix Trap",
    anomalyText:
      "In the first quarter of 2026, the local market registered 14 sales totaling $16.6M. Automated estimates in March published a median price drop to $910,000, signaling a steep crash. In reality, this was a statistical illusion caused by a higher concentration of lower-value townhouse trades. True land value for premium residential estates in Northcross remained solid.",
    compareLabel: "Compared to 2025 H2 Average",
    comparePriceChange: "-24.0%",
    comparePriceUp: false,
    compareSalesChange: "0.0%",
    compareSalesUp: true,
    compareDaysChange: "-14",
    compareDaysUp: true,
  },
  {
    key: "2026-YTD-H1",
    name: "2026 Year-to-Date (Jan–May)",
    periodText: "January – May 2026",
    months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
    anomalyTitle: "Cumulative Market Correction",
    anomalyText:
      "Looking at the cumulative Jan–May 2026 data (5 months of available transactions), the volume rebounded strongly to $36.4M across 30 sales, smoothing out the product mix anomalies seen in Q1 alone. With the average time to sell stabilising at 39 days, it gently reminds us why looking at a single month or quarter in isolation rarely tells the whole story for our local streets. Note: June 2026 data is not yet available; this report will be updated when REINZ releases the full H1 figures.",
    compareLabel: "Compared to 2025 H2 Average",
    comparePriceChange: "-8.9%",
    comparePriceUp: false,
    compareSalesChange: "+28.6%",
    compareSalesUp: true,
    compareDaysChange: "-5",
    compareDaysUp: true,
  },
];

export function getCumulativeReports(rawData: CSVRow[]): ReportDef[] {
  const reports: ReportDef[] = reportDefs.map((r) => ({ ...r, data: [] }));

  rawData.forEach((row) => {
    const period = row["Period"];
    if (!period) return;
    const yearMonth = period.substring(0, 7);
    reports.forEach((report) => {
      if (report.months.some((m) => yearMonth.startsWith(m))) {
        report.data.push(row);
      }
    });
  });

  return reports.filter((r) => r.data.length > 0);
}

export function aggregateReportMetrics(
  report: ReportDef,
  rawData: CSVRow[],
): ReportMetrics {
  let totalVolume = 0;
  let totalSales = 0;
  let daysToSellSum = 0;
  let daysToSellCount = 0;

  interface MonthlyBreakdown {
    monthName: string;
    medianPrice: number;
    salesCount: number;
    vol: number;
    days: number;
    rawPeriod: string;
  }

  const monthlyBreakdown: MonthlyBreakdown[] = report.data.map((row) => {
    const d = new Date(row["Period"]);
    const monthName = d
      .toLocaleString("en-NZ", { month: "short", year: "2-digit" })
      .replace(" ", "-");
    const medianPrice = parseFloat(row["Median Sale Price"]) || NaN;
    const salesCount = parseInt(row["No of Sales"]) || 0;
    const vol = parseFloat(row["Total Sales Volume"]) || 0;
    const days = parseInt(row["Median Days to Sell"]) || NaN;

    totalVolume += vol;
    totalSales += salesCount;

    if (!isNaN(days)) {
      daysToSellSum += days;
      daysToSellCount++;
    }

    return {
      monthName,
      medianPrice,
      salesCount,
      vol,
      days,
      rawPeriod: row["Period"],
    };
  });

  const avgDaysToSell: number | "N/A" =
    daysToSellCount > 0 ? Math.round(daysToSellSum / daysToSellCount) : "N/A";

  const trendRows: TrendRow[] = monthlyBreakdown
    .map((curr) => {
      const currIndex = rawData.findIndex(
        (r) => r["Period"] === curr.rawPeriod,
      );
      let prevPrice = NaN;
      let prevSales = 0;
      let prevDays = NaN;

      if (currIndex > 0) {
        const prevRow = rawData[currIndex - 1];
        prevPrice = parseFloat(prevRow["Median Sale Price"]) || NaN;
        prevSales = parseInt(prevRow["No of Sales"]) || 0;
        prevDays = parseInt(prevRow["Median Days to Sell"]) || NaN;
      }

      let priceDiffPct = "N/A";
      if (!isNaN(curr.medianPrice) && !isNaN(prevPrice) && prevPrice > 0) {
        const diff = ((curr.medianPrice - prevPrice) / prevPrice) * 100;
        priceDiffPct = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
      }

      let salesDiffPct = "N/A";
      if (curr.salesCount > 0 && prevSales > 0) {
        const diff = ((curr.salesCount - prevSales) / prevSales) * 100;
        salesDiffPct = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
      }

      let daysDiff = "N/A";
      if (!isNaN(curr.days) && !isNaN(prevDays)) {
        const diff = curr.days - prevDays;
        daysDiff = (diff >= 0 ? "+" : "") + diff;
      }

      return {
        monthName: curr.monthName,
        currPrice: curr.medianPrice,
        prevPrice: prevPrice,
        priceDiffPct,
        currSales: curr.salesCount,
        prevSales: prevSales,
        salesDiffPct,
        currDays: curr.days,
        prevDays: prevDays,
        daysDiff,
      };
    })
    .reverse();

  return {
    name: report.name,
    periodText: report.periodText,
    totalVolume,
    totalSales,
    avgDaysToSell,
    anomalyTitle: report.anomalyTitle,
    anomalyText: report.anomalyText,
    compareLabel: report.compareLabel,
    comparePriceChange: report.comparePriceChange,
    comparePriceUp: report.comparePriceUp,
    compareSalesChange: report.compareSalesChange,
    compareSalesUp: report.compareSalesUp,
    compareDaysChange: report.compareDaysChange,
    compareDaysUp: report.compareDaysUp,
    trendRows,
  };
}
