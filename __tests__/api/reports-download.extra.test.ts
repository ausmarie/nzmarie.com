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
import { POST } from "../../app/api/reports/download/route";
import { query } from "../../lib/db";

describe("reports download route extra cases", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts requests for suburbs even when the report has not been generated yet", async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: "request-1" }] } as any);

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "Northcross", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("request");
    expect(json.downloadUrl).toBeUndefined();
  });

  it("rejects North Shore as a request suburb", async () => {
    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "North Shore", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
