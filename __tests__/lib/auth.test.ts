import { vi, describe, it, expect } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}));

import { hasPermission } from "../../lib/auth";

describe("hasPermission", () => {
  it("super_admin can access super_admin level", () => {
    expect(hasPermission("super_admin", "super_admin")).toBe(true);
  });

  it("super_admin can access admin level", () => {
    expect(hasPermission("super_admin", "admin")).toBe(true);
  });

  it("super_admin can access viewer level", () => {
    expect(hasPermission("super_admin", "viewer")).toBe(true);
  });

  it("admin can access admin level", () => {
    expect(hasPermission("admin", "admin")).toBe(true);
  });

  it("admin can access viewer level", () => {
    expect(hasPermission("admin", "viewer")).toBe(true);
  });

  it("admin cannot access super_admin level", () => {
    expect(hasPermission("admin", "super_admin")).toBe(false);
  });

  it("viewer can access viewer level", () => {
    expect(hasPermission("viewer", "viewer")).toBe(true);
  });

  it("viewer cannot access admin level", () => {
    expect(hasPermission("viewer", "admin")).toBe(false);
  });

  it("viewer cannot access super_admin level", () => {
    expect(hasPermission("viewer", "super_admin")).toBe(false);
  });

  it("undefined role cannot access any level", () => {
    expect(hasPermission(undefined, "viewer")).toBe(false);
    expect(hasPermission(undefined, "admin")).toBe(false);
    expect(hasPermission(undefined, "super_admin")).toBe(false);
  });

  it("unknown role cannot access any level", () => {
    expect(hasPermission("unknown_role", "viewer")).toBe(false);
  });
});
