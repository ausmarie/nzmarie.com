import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSignedDownloadUrl, uploadToR2 } from "../../lib/r2-storage";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock-signed-url.example.com/file.pdf"),
}));

describe("r2-storage (mock credentials)", () => {
  beforeEach(() => {
    process.env.R2_ACCESS_KEY_ID = "mock-r2-access-key-id";
    process.env.R2_SECRET_ACCESS_KEY = "mock-r2-secret-access-key";
    process.env.R2_ACCOUNT_ID = "a128bb5285b94a778d4b098fbd8266f1";
    process.env.R2_ENDPOINT = "https://a128bb5285b94a778d4b098fbd8266f1.r2.cloudflarestorage.com";
    process.env.R2_BUCKET_NAME = "nzmarie-reports";
  });

  describe("getSignedDownloadUrl", () => {
    it("returns a mock URL string when using mock credentials", async () => {
      const url = await getSignedDownloadUrl("reports/Northcross/2026-Q2.pdf");
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    });

    it("returns a local relative path for the key in mock mode", async () => {
      const key = "reports/Northcross/2026-Q2.pdf";
      const url = await getSignedDownloadUrl(key);
      expect(url).toBe(`/reports/pdf/${key.replace(/^reports\//, "")}`);
    });
  });

  describe("uploadToR2", () => {
    it("returns the key when using mock credentials", async () => {
      const key = "reports/test/test.pdf";
      const result = await uploadToR2(key, Buffer.from("test pdf content"));
      expect(result).toBe(key);
    });

    it("accepts custom content type", async () => {
      const key = "test/file.txt";
      const result = await uploadToR2(key, Buffer.from("text"), "text/plain");
      expect(result).toBe(key);
    });
  });
});
