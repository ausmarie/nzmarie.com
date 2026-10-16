import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import HousePage from "../app/house/page";

let mockUtmSource: string | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => mockUtmSource,
  }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />,
}));

vi.mock("next/link", () => ({
  default: (props: any) => <a {...props}>{props.children}</a>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: any) => <div {...props}>{props.children}</div>,
    p: (props: any) => <p {...props}>{props.children}</p>,
  },
  AnimatePresence: (props: any) => <>{props.children}</>,
}));

let mockFetchReject = false;
let mockFetchApiReject = false;

const mockFetch = vi.fn().mockImplementation((url) => {
  if (url.includes("nominatim")) {
    if (mockFetchReject) {
      return Promise.reject(new Error("Network Error"));
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { place_id: 1, display_name: "123 Queen Street, Auckland Central" },
      ]),
    });
  }
  
  if (mockFetchApiReject) {
    return Promise.reject(new Error("API Error"));
  }
  
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  });
});
global.fetch = mockFetch;

describe("HousePage", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.useFakeTimers();
    mockUtmSource = null;
    mockFetchReject = false;
    mockFetchApiReject = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should render initial components and respond to input changes", async () => {
    render(<HousePage />);

    expect(screen.getByText("Data-Driven.")).toBeDefined();
    expect(screen.getByText("Unlock the True Value of Your Standalone House.")).toBeDefined();
    expect(
      screen.getByText(
        "Combine 10 years of financial markets data with deep local economics expertise to maximize capital growth for your family home."
      )
    ).toBeDefined();

    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: "123 Queen Street" } });
    expect((input as HTMLInputElement).value).toBe("123 Queen Street");
  });

  it("should fetch suggestions and display them in dropdown", async () => {
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("123 Queen Street, Auckland Central")).toBeDefined();

    const suggestionBtn = screen.getByText("123 Queen Street, Auckland Central");
    fireEvent.click(suggestionBtn);
    expect((input as HTMLInputElement).value).toBe("123 Queen Street, Auckland Central");
  });

  it("should handle search API errors gracefully", async () => {
    mockFetchReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      try {
        await Promise.resolve();
        await Promise.resolve();
      } catch (e) {}
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle capture-intent API errors gracefully", async () => {
    mockFetchApiReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });
    const submitBtn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle empty search query and clear suggestions", async () => {
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("123 Queen Street, Auckland Central")).toBeDefined();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText("123 Queen Street, Auckland Central")).toBeNull();
  });

  it("should close dropdown when clicking outside", async () => {
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("123 Queen Street, Auckland Central")).toBeDefined();

    // Trigger onFocus to hit suggestions.length > 0 check
    fireEvent.focus(input);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("123 Queen Street, Auckland Central")).toBeNull();
  });

  it("should transition through analyzing stages and display the lead step", async () => {
    mockUtmSource = "google";
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "100 Beach Road" } });

    const submitBtn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(submitBtn);

    expect(mockFetch).toHaveBeenCalledWith("/api/capture-intent", expect.any(Object));
    expect(screen.getByText("Analyzing Valuation Model")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("Appraisal Prepared")).toBeDefined();
    expect(screen.getByText("100 Beach Road")).toBeDefined();
  });

  it("should submit lead form and show success screen, then reset", async () => {
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "100 Beach Road" } });

    const submitBtn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(submitBtn);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const nameInput = screen.getByPlaceholderText("John Doe");
    const emailInput = screen.getByPlaceholderText("john@example.co.nz");
    const phoneInput = screen.getByPlaceholderText("021 234 567");

    fireEvent.change(nameInput, { target: { value: "Alice Smith" } });
    fireEvent.change(emailInput, { target: { value: "alice@example.com" } });
    fireEvent.change(phoneInput, { target: { value: "027 888 888" } });

    const leadSubmitBtn = screen.getByRole("button", { name: /Get Free Analysis Report/i });
    fireEvent.click(leadSubmitBtn);

    expect(mockFetch).toHaveBeenCalledWith("/api/submit-appraisal", expect.any(Object));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Report Requested!")).toBeDefined();

    const resetBtn = screen.getByRole("button", { name: /Analyze Another Address/i });
    fireEvent.click(resetBtn);

    expect(screen.getByPlaceholderText("Enter your family home address in Auckland...")).toBeDefined();
  });

  it("should submit lead form with selectedAddress when suggestions were picked", async () => {
    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "123 Queen" } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const suggestionBtn = screen.getByText("123 Queen Street, Auckland Central");
    fireEvent.click(suggestionBtn);

    const submitBtn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(submitBtn);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("123 Queen Street, Auckland Central")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("John Doe");
    const emailInput = screen.getByPlaceholderText("john@example.co.nz");

    fireEvent.change(nameInput, { target: { value: "Alice Smith" } });
    fireEvent.change(emailInput, { target: { value: "alice@example.com" } });

    const leadSubmitBtn = screen.getByRole("button", { name: /Get Free Analysis Report/i });
    fireEvent.click(leadSubmitBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Report Requested!")).toBeDefined();
  });

  it("should handle lead submit API errors gracefully", async () => {
    mockFetchApiReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<HousePage />);
    const input = screen.getByPlaceholderText("Enter your family home address in Auckland...");
    fireEvent.change(input, { target: { value: "100 Beach Road" } });

    const submitBtn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(submitBtn);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const nameInput = screen.getByPlaceholderText("John Doe");
    const emailInput = screen.getByPlaceholderText("john@example.co.nz");

    fireEvent.change(nameInput, { target: { value: "Alice Smith" } });
    fireEvent.change(emailInput, { target: { value: "alice@example.com" } });

    const leadSubmitBtn = screen.getByRole("button", { name: /Get Free Analysis Report/i });
    fireEvent.click(leadSubmitBtn);

    await act(async () => {
      try {
        await Promise.resolve();
      } catch (e) {}
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
