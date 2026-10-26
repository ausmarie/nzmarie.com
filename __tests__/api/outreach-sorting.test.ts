import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/outreach/route";
import { parseReportQuarter } from "@/lib/outreach-quarter";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: "admin@test.com" },
  }),
}));

vi.mock("@/lib/permissions", () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/db", () => ({
  marieDB: {
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  outreachCardsKey: vi.fn().mockReturnValue("test-key"),
  getOutreachCardsFromCache: vi.fn().mockResolvedValue(null),
  setOutreachCardsInCache: vi.fn().mockResolvedValue(undefined),
  invalidateDashboardStatsCache: vi.fn().mockResolvedValue(undefined),
  invalidateStreetClustersForSuburb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/streetview", () => ({
  batchGetCachedR2Urls: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/outreach-quarter", () => ({
  parseReportQuarter: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/outreach-cache-key", () => ({
  getQueryCacheKey: vi.fn().mockReturnValue("cache-key"),
}));

import { marieDB } from "@/lib/db";
import { invalidateDashboardStatsCache, invalidateStreetClustersForSuburb } from "@/lib/redis";

describe("Outreach API - Sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force legacy query path for testing
    vi.stubEnv("USE_OUTREACH_MV", "false");
  });

  it("uses the same deterministic send-time ordering for pending sent addresses", async () => {
    const mockRows = [
      { id: "1", property_address: "1 Main St", created_at: "2026-01-15T10:00:00Z", status: "pending" },
      { id: "2", property_address: "2 Oak Ave", created_at: "2026-01-10T10:00:00Z", status: "pending" },
      { id: "3", property_address: "3 Elm St", created_at: "2026-01-20T10:00:00Z", status: "pending" },
    ];

    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: mockRows }) // data query
      .mockResolvedValueOnce({ rows: [{ total: "3" }] }); // count query

    const url = new URL("http://localhost/api/admin/outreach?status=pending&sent_status=sent&sort_mode=time&sortOrder=desc&page=1&limit=10");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify the query was called with correct ORDER BY for pending + time sort
    // Should use ls.sent_at (most recent send log) then op.created_at as fallback
    const queryCall = (marieDB.query as Mock).mock.calls[0];
    const querySql = queryCall[0];
    expect(querySql).toContain("ORDER BY COALESCE(ls.sent_at, op.last_sent_at, op.sent_at AT TIME ZONE 'Pacific/Auckland') DESC NULLS LAST, op.created_at DESC NULLS LAST, op.property_address ASC, op.id ASC");
  });

  it.each([false, true])("matches selected route streets using the canonical property-address street (MV=%s)", async (useMv) => {
    vi.stubEnv("USE_OUTREACH_MV", String(useMv));
    (marieDB.query as Mock)
      .mockResolvedValueOnce({
        rows: [{
          id: "route-address",
          street: "East Coast Road Fairview",
          property_address: "1010 East Coast Road",
          suburb: "Fairview Heights",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] });

    const request = new NextRequest(new URL(
      "http://localhost/api/admin/outreach?status=pending&suburb=Fairview+Heights&streets=East+Coast+Road"
    ));
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(String((marieDB.query as Mock).mock.calls[0][0])).toContain(
      "REGEXP_REPLACE(SPLIT_PART"
    );
    expect(body.data[0].street).toBe("East Coast Road");
  });

  it("uses the same deterministic send-time ordering for Sent addresses (legacy query)", async () => {
    const mockRows = [
      { id: "1", property_address: "1 Main St", sent_at: "2026-01-15T10:00:00Z", status: "sent" },
      { id: "2", property_address: "2 Oak Ave", sent_at: "2026-01-10T10:00:00Z", status: "sent" },
      { id: "3", property_address: "3 Elm St", sent_at: "2026-01-20T10:00:00Z", status: "sent" },
    ];

    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: mockRows })
      .mockResolvedValueOnce({ rows: [{ total: "3" }] });

    const url = new URL("http://localhost/api/admin/outreach?status=sent&sort_mode=time&page=1&limit=10");
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify the query was called with correct ORDER BY for sent + time sort (legacy uses ls.sent_at)
    const queryCall = (marieDB.query as Mock).mock.calls[0];
    const querySql = queryCall[0];
    expect(querySql).toContain("ORDER BY COALESCE(ls.sent_at, op.last_sent_at, op.sent_at AT TIME ZONE 'Pacific/Auckland') DESC NULLS LAST, op.created_at DESC NULLS LAST, op.property_address ASC, op.id ASC");
  });

  it("uses the shared deterministic send-time ordering when the materialized view is enabled", async () => {
    vi.stubEnv("USE_OUTREACH_MV", "true");
    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: [] }) // data query
      .mockResolvedValueOnce({ rows: [{ total: "0" }] }); // count query

    const request = new NextRequest(
      new URL("http://localhost/api/admin/outreach?status=sent&sort_mode=time&page=1&limit=10")
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    const querySql = (marieDB.query as Mock).mock.calls[0][0];
    expect(querySql).toContain(
      "ORDER BY COALESCE(latest_sent_at, last_sent_at, sent_at AT TIME ZONE 'Pacific/Auckland') DESC NULLS LAST, created_at DESC NULLS LAST, property_address ASC, id ASC"
    );
  });

  it.each([false, true])(
    "uses quarter status as the source of truth after Return to Pending (MV=%s)",
    async (useMv) => {
      vi.stubEnv("USE_OUTREACH_MV", String(useMv));
      vi.mocked(parseReportQuarter).mockReturnValueOnce({
        quarter: "Q3",
        year: 2026,
        key: "2026-Q3",
        campaignPattern: "^2026[_-]Q3",
      });
      (marieDB.query as Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: "0" }] });

      const request = new NextRequest(new URL(
        "http://localhost/api/admin/outreach?status=pending&sent_status=sent&report_quarter=2026-Q3&suburb=Fairview+Heights"
      ));
      const response = await GET(request);

      expect(response.status).toBe(200);
      const query = String((marieDB.query as Mock).mock.calls[0][0]);
      expect(query).toContain("outreach_property_quarter_status");
      expect(query).toContain("quarter_status.status = 'pending'");
      expect(query).toContain("quarter_status.status IN ('sent', 'partial')");
      expect(query).toContain("qst.status = 'pending'");
      expect(JSON.stringify((marieDB.query as Mock).mock.calls[0][1])).toContain("^2026[_-]Q3");
    }
  );

  it("classifies a returned Q3 send as unsent even while its historical send log remains", async () => {
    vi.mocked(parseReportQuarter).mockReturnValueOnce({
      quarter: "Q3",
      year: 2026,
      key: "2026-Q3",
      campaignPattern: "^2026[_-]Q3",
    });
    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: "0" }] });

    const request = new NextRequest(new URL(
      "http://localhost/api/admin/outreach?status=pending&sent_status=unsent&report_quarter=2026-Q3&suburb=Fairview+Heights"
    ));
    const response = await GET(request);

    expect(response.status).toBe(200);
    const query = String((marieDB.query as Mock).mock.calls[0][0]);
    expect(query).toContain("NOT (");
    expect(query).toContain("quarter_status.status = 'pending'");
    expect(query).toContain("quarter_status.status IN ('sent', 'partial')");
  });
});

describe("Outreach Status API - Return to Pending preserves quarter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("USE_OUTREACH_MV", "false");
  });

  it("returns an address to pending for only the selected quarter and preserves send logs", async () => {
    const { PATCH } = await import("@/app/api/admin/outreach/[id]/status/route");

    const mockRow = { id: "test-id", suburb: "Torbay", status: "pending" };
    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: [mockRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    const url = new URL("http://localhost/api/admin/outreach/test-id/status");
    const request = new NextRequest(url, {
      method: "PATCH",
      body: JSON.stringify({
        status: "pending",
        return_to_pending: true,
        report_quarter: "2026-Q3",
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const calls = (marieDB.query as Mock).mock.calls;
    expect(calls[0][0]).toContain("UPDATE outreach_properties");
    expect(calls[1][0]).toContain("UPDATE outreach_property_quarter_status");
    expect(calls[1][0]).toContain("year = $2");
    expect(calls[1][0]).toContain("quarter = $3");
    expect(calls[1][1]).toEqual(["test-id", 2026, "Q3"]);
    expect(calls[2][0]).toContain("INSERT INTO outreach_property_quarter_status");
    expect(calls[2][0]).toContain("FROM outreach_send_logs sl");
    expect(calls[2][0]).toContain("ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE");
    expect(calls.slice(0, 3).every(([query]) => !String(query).includes("DELETE FROM"))).toBe(true);
    expect(invalidateStreetClustersForSuburb).toHaveBeenCalledWith("Torbay");
    expect(invalidateDashboardStatsCache).toHaveBeenCalledOnce();
  });

  it("resolves the latest quarter from quarter status when no quarter is selected", async () => {
    const { PATCH } = await import("@/app/api/admin/outreach/[id]/status/route");
    (marieDB.query as Mock)
      .mockResolvedValueOnce({ rows: [{ year: 2026, quarter: "Q3" }] })
      .mockResolvedValueOnce({ rows: [{ id: "test-id", suburb: "Torbay", status: "pending" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    const request = new NextRequest("http://localhost/api/admin/outreach/test-id/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "pending", return_to_pending: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });

    expect(response.status).toBe(200);
    const calls = (marieDB.query as Mock).mock.calls;
    expect(calls[0][0]).toContain("FROM outreach_property_quarter_status q");
    expect(calls[0][0]).toContain("FROM outreach_send_logs sl");
    expect(calls[2][1]).toEqual(["test-id", 2026, "Q3"]);
    expect(invalidateDashboardStatsCache).toHaveBeenCalledOnce();
  });
});