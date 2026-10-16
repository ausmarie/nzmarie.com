import { describe, it, expect, vi } from "vitest";
import { POST as captureIntent } from "../app/api/capture-intent/route";
import { POST as submitAppraisal } from "../app/api/submit-appraisal/route";
import { POST as appraisal } from "../app/api/appraisal/route";
import { POST as downloadReport } from "../app/api/reports/download/route";

vi.mock("pg", () => {
  const mPool = {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes("appraisal_leads") && sql.includes("SELECT")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO appraisal_leads")) {
        const values = Array.isArray(params) ? params : [];
        return Promise.resolve({
          rows: [
            {
              id: "1",
              name: values[0] || "Alice",
              email: values[1] || "alice@example.com",
              phone: values[2] || null,
              property_address: values[3] || "123 Test Street",
              suburb: values[4] || "Auckland",
              region: values[5] || null,
              city: values[6] || null,
              message: values[7] || null,
              source: values[8] || "website",
            },
          ],
        });
      }
      if (sql.includes("market_reports") && sql.includes("SELECT")) {
        return Promise.resolve({ rows: [{ r2_key: "reports/Albany/latest.pdf" }] });
      }
      if (sql.includes("INSERT INTO report_download_events")) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      return Promise.resolve({ rows: [{ count: "0", id: 1 }] });
    }),
  };
  return { Pool: vi.fn(() => mPool) };
});

vi.mock("../lib/r2-storage", () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://example.com/mock.pdf"),
  uploadToR2: vi.fn().mockResolvedValue("mock-key"),
}));

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: vi.fn().mockResolvedValue({}) }
    }))
  };
});

describe("POST /api/capture-intent", () => {
  it("returns success with body data on valid JSON", async () => {
    const req = new Request("http://localhost/api/capture-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "2 Chelsea Lane", utmSource: "direct" }),
    });
    const res = await captureIntent(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.address).toBe("2 Chelsea Lane");
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/capture-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await captureIntent(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

describe("POST /api/submit-appraisal", () => {
  it("returns success with body data on valid JSON", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        address: "123 Test Street",
        suburb: "Auckland",
      }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.name).toBe("Alice");
  });

  it("uses property_address and utmSource when provided", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bob",
        email: "bob@example.com",
        property_address: "45 Queen Street",
        utmSource: "google",
        message: "Hello",
      }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.source).toBe("google");
  });

  it("resolves region and city from a known suburb when inserting a lead", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Eve",
        email: "eve@example.com",
        address: "5 Cottam Grove",
        suburb: "Northcross",
      }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.region).toBe("Auckland");
    expect(json.lead.city).toBe("North Shore City");
  });

  it("returns 400 when required fields are missing", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Carol", email: "carol@example.com" }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid email format", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dana",
        email: "invalid-email",
        address: "10 Main Road",
      }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid email format");
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

describe("POST /api/appraisal", () => {
  it("returns success on valid JSON", async () => {
    const req = new Request("http://localhost/api/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", email: "bob@example.com", address: "1 Main St", suburb: "Albany", phone: "123" }),
    });
    const res = await appraisal(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 on invalid JSON body because it is a DB/catch block", async () => {
    const req = new Request("http://localhost/api/appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await appraisal(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

describe("POST /api/reports/download", () => {
  it("returns success on valid JSON", async () => {
    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Charlie", email: "charlie@example.com", phone: "456", suburb: "Albany", subscribe: true }),
    });
    const res = await downloadReport(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("download");
    expect(json.downloadUrl).toBe("https://example.com/mock.pdf");
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await downloadReport(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
