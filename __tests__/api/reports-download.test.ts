import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../app/api/reports/download/route";
import { SUBURB_PRIORITY_ORDER } from "../../lib/suburb-order";

vi.mock("../../lib/db", async (importOriginal) => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    marieDB: {
      query: mockQuery,
    },
  };
});

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

  it("records the request and confirms it will be emailed", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "event-uuid" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "request-uuid" }] } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("request");
    expect(json.downloadUrl).toBeUndefined();
    expect(vi.mocked(query).mock.calls.some(([sql]) =>
      typeof sql === "string" && sql.includes("INSERT INTO report_downloads")
    )).toBe(true);
  });

  it("stores both entry and preferred report languages", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "event-uuid" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "request-uuid" }] } as any);

    const res = await POST(makeRequest({
      ...validBody,
      entryLanguage: "zh",
      preferredLanguage: "en",
    }));

    expect(res.status).toBe(200);
    const eventInsert = vi.mocked(query).mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("INSERT INTO report_download_events")
    );
    const requestInsert = vi.mocked(query).mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("INSERT INTO report_downloads")
    );
    expect(eventInsert?.[1]).toContain("zh");
    expect(eventInsert?.[1]).toContain("en");
    expect(requestInsert?.[1]).toContain("zh");
    expect(requestInsert?.[1]).toContain("en");
  });

  it("rejects unsupported language values", async () => {
    const res = await POST(makeRequest({ ...validBody, preferredLanguage: "fr" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "bad-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid suburb", async () => {
    const res = await POST(makeRequest({ ...validBody, suburb: "FakeSuburb" }));
    expect(res.status).toBe(400);
  });

  it("does not allow North Shore as a selectable suburb", async () => {
    expect(SUBURB_PRIORITY_ORDER).not.toContain("North Shore");
    const res = await POST(makeRequest({ ...validBody, suburb: "North Shore" }));
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
