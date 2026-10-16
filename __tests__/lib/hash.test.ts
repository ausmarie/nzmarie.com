import { describe, it, expect } from "vitest";
import { hashEmail, hashIP, isValidEmail } from "../../lib/hash";

describe("hashEmail", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashEmail("test@example.com");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalises to lowercase before hashing", () => {
    expect(hashEmail("TEST@EXAMPLE.COM")).toBe(hashEmail("test@example.com"));
  });

  it("trims whitespace before hashing", () => {
    expect(hashEmail("  test@example.com  ")).toBe(hashEmail("test@example.com"));
  });

  it("returns the same hash for identical input", () => {
    expect(hashEmail("a@b.com")).toBe(hashEmail("a@b.com"));
  });

  it("returns different hashes for different emails", () => {
    expect(hashEmail("a@b.com")).not.toBe(hashEmail("c@d.com"));
  });
});

describe("hashIP", () => {
  it("hashes an IPv4 address", () => {
    const hash = hashIP("192.168.1.1");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes an IPv6 address", () => {
    const hash = hashIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(hash).toHaveLength(64);
  });

  it("different IPs produce different hashes", () => {
    expect(hashIP("1.1.1.1")).not.toBe(hashIP("8.8.8.8"));
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    const valid = ["user@example.com", "a+b@sub.domain.co.nz", "user.name@test.org"];
    valid.forEach((e) => expect(isValidEmail(e)).toBe(true));
  });

  it("rejects invalid emails", () => {
    const invalid = ["plaintext", "@domain.com", "user@", "user @domain.com", "user@.com"];
    invalid.forEach((e) => expect(isValidEmail(e)).toBe(false));
  });
});
