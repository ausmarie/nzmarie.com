import { describe, it, expect } from "vitest";
import { toNZTime, formatNZDate, getNZNow } from "../../lib/timezone";

describe("toNZTime", () => {
  it("converts a UTC date to NZ timezone string", () => {
    const utcDate = new Date("2026-06-18T02:00:00.000Z");
    const result = toNZTime(utcDate);
    expect(result).toMatch(/^2026-06-18 14:00:00$/);
  });

  it("accepts a date string", () => {
    const result = toNZTime("2026-06-18T00:00:00.000Z");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("accepts a timestamp number", () => {
    const ts = new Date("2026-06-18T00:00:00.000Z").getTime();
    const result = toNZTime(ts);
    expect(typeof result).toBe("string");
  });
});

describe("formatNZDate", () => {
  it("formats with the default format", () => {
    const result = formatNZDate(new Date("2026-06-18T02:00:00.000Z"));
    expect(result).toMatch(/2026-06-18/);
  });

  it("formats with a custom format", () => {
    const result = formatNZDate(new Date("2026-06-18T02:00:00.000Z"), "dd/MM/yyyy");
    expect(result).toBe("18/06/2026");
  });
});

describe("getNZNow", () => {
  it("returns a DateTime in Pacific/Auckland zone", () => {
    const dt = getNZNow();
    expect(dt.zoneName).toBe("Pacific/Auckland");
  });

  it("returns the current time (approximately)", () => {
    const dt = getNZNow();
    const diff = Math.abs(dt.toMillis() - Date.now());
    expect(diff).toBeLessThan(2000);
  });
});
