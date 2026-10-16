import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../app/api/appraisal/route";

vi.mock("../../lib/db", () => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    marieDB: { query: mockQuery },
    louisDB: { query: vi.fn() },
    queryLouis: vi.fn(),
    ensureOutreachTablesExist: vi.fn(),
  };
});

vi.mock("../../lib/email", () => ({
  sendAppraisalNotification: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
}));

import { query } from "../../lib/db";

const db = { query };

describe("POST /api/appraisal (refactored)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    name: "Jane Smith",
    address: "42 Queen Street, Auckland CBD",
    region: "Auckland",
    city: "North Shore City",
    suburb: "Albany",
    email: "jane@example.com",
    phone: "+64 21 555 0101",
    timeline: "within-3-months",
    motivation: "upsizing",
  };

  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 200 on valid submission", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "new-uuid" }] } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("email");
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for missing address", async () => {
    const res = await POST(makeRequest({ ...validBody, address: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing phone", async () => {
    const res = await POST(makeRequest({ ...validBody, phone: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when duplicate submission within 7 days", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: "existing-uuid" }] } as any);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("already submitted");
  });

  it("returns 500 on database error", async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 500 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 for missing suburb", async () => {
    const res = await POST(makeRequest({ ...validBody, suburb: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Suburb");
  });

  it("accepts valid submission with region and city", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "new-uuid" }] } as any);

    const res = await POST(makeRequest({
      ...validBody,
      region: "Auckland",
      city: "Auckland City",
      suburb: "Takapuna",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("auto-resolves region and city from suburb when not provided", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "new-uuid" }] } as any);

    const bodyWithoutLocation = {
      name: "Jane Smith",
      address: "42 Queen Street, Auckland CBD",
      suburb: "Albany",
      email: "jane@example.com",
      phone: "+64 21 555 0101",
      timeline: "within-3-months",
      motivation: "upsizing",
    };

    const res = await POST(makeRequest(bodyWithoutLocation));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
