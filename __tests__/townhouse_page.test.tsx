import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import TownhousePage from "../app/townhouse/page";

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
        { place_id: 42, display_name: "2 Chelsea Lane, Auckland" },
        { place_id: 43, display_name: "4 Chelsea Lane, Auckland" },
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

describe("TownhousePage", () => {
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

  it("renders hero copy specific to townhouse", () => {
    render(<TownhousePage />);
    expect(screen.getByText("Data-Driven.")).toBeDefined();
    expect(screen.getByText("Expert Analysis for Your Townhouse Enclave.")).toBeDefined();
    expect(
      screen.getByText(
        "Maps the 2026 lending criteria, yield, and systemic market shifts for your modern lane property."
      )
    ).toBeDefined();
  });

  it("renders Licensed Salesperson badge", () => {
    render(<TownhousePage />);
    expect(screen.getByText(/Licensed Residential Sales/i)).toBeDefined();
  });

  it("renders all three bottom credential icons", () => {
    render(<TownhousePage />);
    expect(screen.getByText("MA in Economics")).toBeDefined();
    expect(screen.getByText("10+ Years Markets")).toBeDefined();
    expect(screen.getByText("Barfoot & Thompson")).toBeDefined();
  });

  it("renders townhouse-specific address placeholder", () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    expect(input).toBeDefined();
  });

  it("updates input value when user types", () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    expect((input as HTMLInputElement).value).toBe("2 Chelsea Lane");
  });

  it("submit button is disabled when input is empty", () => {
    render(<TownhousePage />);
    const btn = screen.getByRole("button", { name: /Analyze Value/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("submit button is enabled when input has text", () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    const btn = screen.getByRole("button", { name: /Analyze Value/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("fetches address suggestions after debounce and displays dropdown", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });

    act(() => { vi.advanceTimersByTime(500); });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("2 Chelsea Lane, Auckland")).toBeDefined();
    expect(screen.getByText("4 Chelsea Lane, Auckland")).toBeDefined();
  });

  it("handles search API error gracefully", async () => {
    mockFetchReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });

    act(() => { vi.advanceTimersByTime(500); });

    await act(async () => {
      try {
        await Promise.resolve();
        await Promise.resolve();
      } catch (e) {}
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("selects a suggestion and closes dropdown", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });

    act(() => { vi.advanceTimersByTime(500); });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("2 Chelsea Lane, Auckland"));
    expect((input as HTMLInputElement).value).toBe("2 Chelsea Lane, Auckland");
    expect(screen.queryByText("4 Chelsea Lane, Auckland")).toBeNull();
  });

  it("closes dropdown on click outside and triggers focus block when suggestions are loaded", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });

    act(() => { vi.advanceTimersByTime(500); });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("2 Chelsea Lane, Auckland")).toBeDefined();
    
    // Focus to cover if condition
    fireEvent.focus(input);
    
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("2 Chelsea Lane, Auckland")).toBeNull();
  });

  it("clears suggestions when input is emptied", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });
    act(() => { vi.advanceTimersByTime(500); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    fireEvent.change(input, { target: { value: "" } });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByText("2 Chelsea Lane, Auckland")).toBeNull();
  });

  it("transitions to analyzing step on form submit and fires capture-intent", () => {
    mockUtmSource = "direct";
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });

    const btn = screen.getByRole("button", { name: /Analyze Value/i });
    fireEvent.click(btn);

    expect(mockFetch).toHaveBeenCalledWith("/api/capture-intent", expect.any(Object));
    expect(screen.getByText("Analyzing Valuation Model")).toBeDefined();
  });

  it("handles capture intent API error gracefully", async () => {
    mockFetchApiReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("shows townhouse-specific analysis messages during analyzing step", () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    expect(screen.getByText("Mapping 2026 lending criteria impact on townhouse valuations...")).toBeDefined();

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText("Correlating yield benchmarks & cash flow potential for your enclave...")).toBeDefined();

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText("Compiling comparative townhouse market intelligence model...")).toBeDefined();
  });

  it("transitions to lead form after analysis completes", () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    act(() => { vi.advanceTimersByTime(4000); });

    expect(screen.getByText("Appraisal Prepared")).toBeDefined();
    expect(screen.getByText("2 Chelsea Lane")).toBeDefined();
  });

  it("shows selected address in lead form when suggestion was picked", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "Chelsea" } });
    act(() => { vi.advanceTimersByTime(500); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    fireEvent.click(screen.getByText("2 Chelsea Lane, Auckland"));
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText("2 Chelsea Lane, Auckland")).toBeDefined();
  });

  it("submits lead form, shows success screen, then resets", async () => {
    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    act(() => { vi.advanceTimersByTime(4000); });

    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Bob Lee" } });
    fireEvent.change(screen.getByPlaceholderText("john@example.co.nz"), { target: { value: "bob@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("021 234 567"), { target: { value: "021 111 222" } });

    fireEvent.click(screen.getByRole("button", { name: /Get Free Analysis Report/i }));

    expect(mockFetch).toHaveBeenCalledWith("/api/submit-appraisal", expect.any(Object));

    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Report Requested!")).toBeDefined();
    expect(screen.getByText(/Bob Lee/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Analyze Another Address/i }));

    expect(screen.getByPlaceholderText("Enter your townhouse address (e.g., 2 Chelsea Lane)...")).toBeDefined();
  });

  it("handles lead submit API error gracefully", async () => {
    mockFetchApiReject = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<TownhousePage />);
    const input = screen.getByPlaceholderText(
      "Enter your townhouse address (e.g., 2 Chelsea Lane)..."
    );
    fireEvent.change(input, { target: { value: "2 Chelsea Lane" } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze Value/i }));

    act(() => { vi.advanceTimersByTime(4000); });

    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Bob Lee" } });
    fireEvent.change(screen.getByPlaceholderText("john@example.co.nz"), { target: { value: "bob@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: /Get Free Analysis Report/i }));

    await act(async () => {
      try {
        await Promise.resolve();
      } catch (e) {}
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("renders the why section with townhouse-specific headings", () => {
    render(<TownhousePage />);
    expect(screen.getByText("2026 Lending Criteria")).toBeDefined();
    expect(screen.getByText("Yield & Cash Flow Analysis")).toBeDefined();
    expect(screen.getByText("Enclave Positioning")).toBeDefined();
  });

  it("renders footer with Barfoot & Thompson disclaimer", () => {
    render(<TownhousePage />);
    expect(screen.getByText(/Barfoot & Thompson Ltd/)).toBeDefined();
    expect(screen.getAllByText(/REAA 2008/).length).toBeGreaterThanOrEqual(1);
  });
});
