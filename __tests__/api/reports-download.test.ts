import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../app/api/reports/download/route";

vi.mock("../../lib/db", async (importOriginal) => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    marieDB: {
      query: mockQuery,
    },
  };
});

vi.mock("../../lib/r2-storage", () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://r2.example.com/signed-url?token=abc"),
}));

import { query } from "../../lib/db";

describe("POST /api/reports/download (refactored)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    firstName: "Charlie",
    email: "charlie@example.com",
    phone: "021 555 0202",
    suburb: "Albany",
    subscribe: true,
  };

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 200 with signed URL on valid request", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ r2_key: "reports/Albany/2026-Q2.pdf" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "event-uuid" }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("download");
    expect(json.downloadUrl).toBe("https://r2.example.com/signed-url?token=abc");
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "bad-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid suburb", async () => {
    const res = await POST(makeRequest({ ...validBody, suburb: "FakeSuburb" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing firstName", async () => {
    const res = await POST(makeRequest({ ...validBody, firstName: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when download limit reached", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ count: "5" }] } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.reason).toBe("limit");
  });

  it("returns 500 on database error", async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error("DB error"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("returns 500 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
