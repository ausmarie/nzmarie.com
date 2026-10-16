import { describe, it, expect } from "vitest";
import { POST } from "../app/api/contact/route";

describe("POST /api/contact", () => {
  it("returns 410 because the form is no longer available", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toBe("Contact form submissions are no longer supported.");
  });
});
