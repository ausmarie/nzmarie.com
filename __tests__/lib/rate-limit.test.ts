import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDownloadLimit } from "../../lib/rate-limit";

vi.mock("../../lib/db", () => ({
  query: vi.fn(),
}));

import { query } from "../../lib/db";

describe("checkDownloadLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when count is below limit", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: "3" }] } as any);
    const allowed = await checkDownloadLimit("abc123");
    expect(allowed).toBe(true);
  });

  it("returns false when count meets the limit", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: "5" }] } as any);
    const allowed = await checkDownloadLimit("abc123");
    expect(allowed).toBe(false);
  });

  it("returns false when count exceeds the limit", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: "10" }] } as any);
    const allowed = await checkDownloadLimit("abc123");
    expect(allowed).toBe(false);
  });

  it("respects custom limit parameter", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: "3" }] } as any);
    const allowedAt3 = await checkDownloadLimit("abc123", 3);
    expect(allowedAt3).toBe(false);
    const allowedAt10 = await checkDownloadLimit("abc123", 10);
    expect(allowedAt10).toBe(true);
  });

  it("calls query with correct email hash", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: "0" }] } as any);
    await checkDownloadLimit("myhash123", 5, 30);
    expect(query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["myhash123"]));
  });
});
