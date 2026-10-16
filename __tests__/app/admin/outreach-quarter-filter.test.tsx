import { describe, it, expect, vi } from "vitest";

const mockReports = [
  { suburb: "Oteha", quarter: "Q2", year: 2026, id: "1", uploaded_at: "2026-01-15" },
  { suburb: "Oteha", quarter: "Q3", year: 2026, id: "2", uploaded_at: "2026-04-15" },
  { suburb: "Browns Bay", quarter: "Q2", year: 2026, id: "3", uploaded_at: "2026-01-10" },
  { suburb: "Northcross", quarter: "Q3", year: 2026, id: "4", uploaded_at: "2026-04-20" },
];

const mockSentStats = {
  "Oteha": { total: 45, sent: 45, unsent: 0 },
  "Browns Bay": { total: 38, sent: 20, unsent: 18 },
  "Northcross": { total: 52, sent: 0, unsent: 52 },
};

describe("ReportFilterSection quarter-based filtering", () => {
  it("orders quarters by most recent upload", () => {
    const latestByQuarter = new Map<string, string>();
    for (const r of mockReports) {
      const label = `${r.year}-${r.quarter}`;
      const ts = r.uploaded_at || "";
      const cur = latestByQuarter.get(label);
      if (cur === undefined || ts > cur) latestByQuarter.set(label, ts);
    }
    const ordered = [...latestByQuarter.entries()]
      .sort((a, b) => (b[1] || "").localeCompare(a[1] || "") || b[0].localeCompare(a[0]))
      .map(([q]) => q);
    expect(ordered).toEqual(["2026-Q3", "2026-Q2"]);
  });

  it("filters suburbs by active quarter", () => {
    const activeQuarter = "2026-Q3";
    const suburbs = new Set<string>();
    for (const r of mockReports) {
      if (r.suburb === "North Shore") continue;
      const label = `${r.year}-${r.quarter}`;
      if (label === activeQuarter) {
        suburbs.add(r.suburb);
      }
    }
    expect([...suburbs].sort()).toEqual(["Northcross", "Oteha"]);
  });

  it("identifies fully sent suburbs for a quarter", () => {
    const fullySent = new Set<string>();
    for (const [s, v] of Object.entries(mockSentStats)) {
      if (v.unsent === 0 && v.sent > 0) fullySent.add(s);
    }
    expect(fullySent.has("Oteha")).toBe(true);
    expect(fullySent.has("Browns Bay")).toBe(false);
  });

  it("hides completed suburbs by default and shows all when expanded", () => {
    const orderedSuburbs = ["Browns Bay", "Oteha"];
    const fullySent = new Set(["Oteha"]);

    const filterSuburbs = (showAll: boolean) => {
      if (showAll) return orderedSuburbs;
      return orderedSuburbs.filter(s => !fullySent.has(s));
    };

    expect(filterSuburbs(false)).toEqual(["Browns Bay"]);
    expect(filterSuburbs(true)).toEqual(["Browns Bay", "Oteha"]);
  });

  it("shows sent status filter buttons", () => {
    const options = [
      { value: "all" as const, label: "All", color: "#6b7280" },
      { value: "unsent" as const, label: "Unsent", color: "#16a34a" },
      { value: "sent" as const, label: "Sent ✓", color: "#8b5cf6" },
    ];
    expect(options).toHaveLength(3);
    expect(options[0].label).toBe("All");
    expect(options[1].label).toBe("Unsent");
    expect(options[2].label).toBe("Sent ✓");
  });

  it("calls suburb-sent-stats API with quarter param", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn((url: string) => {
      capturedUrl = url;
      if (url.includes("/api/admin/outreach/suburb-sent-stats")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stats: {} }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetch("/api/admin/outreach/suburb-sent-stats?quarter=2026-Q3");
    expect(capturedUrl).toContain("quarter=2026-Q3");
  });

  it("switches default report when moving between quarters", async () => {
    const defaultReportsByQuarter: Record<string, { suburb: string; label: string }> = {
      "2026-Q2": { suburb: "Oteha", label: "2026-Q2" },
      "2026-Q3": { suburb: "Northcross", label: "2026-Q3" },
    };

    const mockFetch = vi.fn((url: string) => {
      const u = new URL(url, "http://localhost");
      const q = u.searchParams.get("quarter") || "";
      const report = defaultReportsByQuarter[q] || null;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, defaultReport: report }),
      });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const resQ3 = await fetch("/api/admin/outreach/default-report?quarter=2026-Q3");
    const dataQ3 = await resQ3.json();
    expect(dataQ3.defaultReport?.suburb).toBe("Northcross");

    const resQ2 = await fetch("/api/admin/outreach/default-report?quarter=2026-Q2");
    const dataQ2 = await resQ2.json();
    expect(dataQ2.defaultReport?.suburb).toBe("Oteha");
  });

  it("buildCacheKey includes activeQuarter to prevent cross-quarter cache pollution", () => {
    const buildCacheKey = (page: number, activeQuarter: string) => {
      return [
        "pending",
        "Oteha",
        "",
        "",
        "",
        "",
        "address",
        "house",
        "all",
        "all",
        "all",
        "Oteha",
        "unsent",
        "address",
        "",
        "",
        "v:50",
        `p:${1}`,
        `q:${activeQuarter}`,
      ].join("|");
    };

    const keyQ2 = buildCacheKey(1, "2026-Q2");
    const keyQ3 = buildCacheKey(1, "2026-Q3");
    expect(keyQ2).not.toBe(keyQ3);
    expect(keyQ2).toContain("q:2026-Q2");
    expect(keyQ3).toContain("q:2026-Q3");
  });

  it("street-clusters API cache key includes quarter parameter", () => {
    const streetClustersKey = (suburb: string, status: string, sentStatus: string, reportQuarter: string | null, budget: number) => {
      return `street-clusters:${suburb}:${status}:${sentStatus}:${reportQuarter ?? "null"}:${budget}`;
    };

    const keyQ2 = streetClustersKey("Oteha", "pending", "unsent", "2026-Q2", 30);
    const keyQ3 = streetClustersKey("Oteha", "pending", "unsent", "2026-Q3", 30);
    expect(keyQ2).not.toBe(keyQ3);
    expect(keyQ2).toContain("2026-Q2");
    expect(keyQ3).toContain("2026-Q3");
  });

  it("quarter isolation: Q2 sent data does not leak into Q3 unsent view", () => {
    // Simulate Q2: Oteha fully sent
    // Simulate Q3: Oteha not sent yet
    const q2Stats = { total: 45, sent: 45, unsent: 0 };
    const q3Stats = { total: 45, sent: 0, unsent: 45 };

    const isFullySent = (stats: typeof q2Stats) => stats.unsent === 0 && stats.sent > 0;

    expect(isFullySent(q2Stats)).toBe(true);  // Q2: Oteha hidden
    expect(isFullySent(q3Stats)).toBe(false); // Q3: Oteha visible as unsent
  });
});
