import { describe, it, expect, vi, beforeEach } from "vitest";

describe("lib/r2-storage additional coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns local path and behaves in mock mode", async () => {
    process.env.R2_ACCESS_KEY_ID = "mock-abc";
    process.env.R2_SECRET_ACCESS_KEY = "mock-secret";
    process.env.R2_BUCKET_NAME = "nz";

    const mod = await import("../../lib/r2-storage");
    expect(mod.getLocalReportUrl("reports/X.pdf")).toBe("/reports/pdf/X.pdf");
    expect(mod.isR2Mock).toBeTruthy();

    const signed = await mod.getSignedDownloadUrl("reports/X.pdf");
    expect(signed).toBe("/reports/pdf/X.pdf");

    const key = await mod.uploadToR2("reports/X.pdf", Buffer.from("x"));
    expect(key).toBe("reports/X.pdf");
  });

  it("uses getSignedUrl and S3 client when not mock", async () => {
    vi.resetModules();
    process.env.R2_ACCESS_KEY_ID = "real-key";
    process.env.R2_SECRET_ACCESS_KEY = "real-secret";
    process.env.R2_BUCKET_NAME = "bucket";

    vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn().mockResolvedValue('https://signed.example') }));
    vi.mock('@aws-sdk/client-s3', () => ({
      S3Client: class {
        send() {
          return Promise.resolve();
        }
      },
      PutObjectCommand: function PutObjectCommand() {},
      GetObjectCommand: function GetObjectCommand() {},
    }));

    const mod = await import("../../lib/r2-storage");

    const signed = await mod.getSignedDownloadUrl("reports/Y.pdf");
    expect(signed).toBe("https://signed.example");

    const key = await mod.uploadToR2("reports/Y.pdf", Buffer.from("y"));
    expect(key).toBe("reports/Y.pdf");
  });
});
