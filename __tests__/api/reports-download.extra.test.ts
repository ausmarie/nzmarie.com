import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/db", async (importOriginal) => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    marieDB: {
      query: mockQuery,
    },
  };
});
vi.mock("../../lib/r2-storage", () => ({ getSignedDownloadUrl: vi.fn().mockResolvedValue("signed-url") }));

import { POST } from "../../app/api/reports/download/route";
import { query } from "../../lib/db";
import { getSignedDownloadUrl } from "../../lib/r2-storage";

describe("reports download route extra cases", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 in production when R2 is not configured", async () => {
    // @ts-expect-error - Allow assignment for testing
    process.env.NODE_ENV = "production";
    process.env.R2_ACCESS_KEY_ID = "mock-1";
    process.env.R2_SECRET_ACCESS_KEY = "mock-2";
    process.env.R2_BUCKET_NAME = "";

    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any) // recent count
      .mockResolvedValueOnce({ rows: [] } as any) // suburbReportResult empty
      .mockResolvedValueOnce({ rows: [{ r2_key: "reports/Albany/latest.pdf" }] } as any); // market_reports has a row

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "Albany", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns no_report when no report row found", async () => {
    // @ts-expect-error - Allow assignment for testing
    process.env.NODE_ENV = "test";
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any) // recent count
      .mockResolvedValueOnce({ rows: [] } as any) // suburbReportResult empty
      .mockResolvedValueOnce({ rows: [] } as any); // reportResult empty

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "Northcross", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.reason).toBe("no_report");
    expect(json.downloadUrl).toBeUndefined();
    expect(getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("accepts North Shore as a valid suburb", async () => {
    // @ts-expect-error - Allow assignment for testing
    process.env.NODE_ENV = "test";
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any) // recent count
      .mockResolvedValueOnce({ rows: [{ id: "r1", file_url: "https://reports.nzmarie.com/reports/North Shore/latest.pdf" }] } as any) // suburb_reports
      .mockResolvedValueOnce({ rows: [] } as any) // update download_count
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] } as any) // insert event
      .mockResolvedValueOnce({ rows: [] } as any); // update status

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "North Shore", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("download");
    expect(json.downloadUrl).toBe("https://reports.nzmarie.com/reports/North Shore/latest.pdf");
  });
});
