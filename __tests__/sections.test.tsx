import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import AppraisalSection from "../components/AppraisalSection";
import ReportDownloadSection from "../components/ReportDownloadSection";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  ToastContainer: () => null,
}));

// Mock Google Maps API
const mockGoogleMaps = {
  places: {
    AutocompleteService: vi.fn().mockImplementation(() => ({
      getPlacePredictions: vi.fn((request, callback) => {
        const predictions = [
          {
            place_id: "mock-place-id-1",
            description: "1 Queen Street, Auckland Central, Auckland 1010, New Zealand",
            structured_formatting: {
              main_text: "1 Queen Street",
              secondary_text: "Auckland Central, Auckland",
            },
          },
        ];
        callback(predictions, "OK");
      }),
    })),
    PlacesService: vi.fn().mockImplementation(() => ({
      getDetails: vi.fn((request, callback) => {
        const placeResult = {
          formatted_address: "1 Queen Street, Auckland Central, Auckland 1010, New Zealand",
          address_components: [
            { long_name: "1", types: ["street_number"] },
            { long_name: "Queen Street", types: ["route"] },
            { long_name: "Auckland Central", types: ["sublocality_level_1", "sublocality", "political"] },
            { long_name: "Auckland", types: ["locality", "political"] },
            { long_name: "1010", types: ["postal_code"] },
          ],
          geometry: {},
        };
        callback(placeResult, "OK");
      }),
    })),
    AutocompleteSessionToken: vi.fn().mockImplementation(() => ({})),
    PlacesServiceStatus: {
      OK: "OK",
      ZERO_RESULTS: "ZERO_RESULTS",
    },
  },
};

(globalThis as any).google = mockGoogleMaps;

// Mock document.createElement for script injection
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'script') {
    // Immediately trigger onload for Google Maps script
    setTimeout(() => {
      if (element.onload) {
        element.onload(new Event('load'));
      }
    }, 0);
  }
  return element;
}) as any;

let mockFetchSuccess = true;
let errorOnAppraisalSubmit = false;
let mockNoReport = false;

const mockFetchImpl = (url: unknown, options?: unknown) => {
  // API endpoints (not Google Maps)
  if (typeof url === 'string' && url.includes("/api/appraisal")) {
    if (errorOnAppraisalSubmit) {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });
    }
    if (!mockFetchSuccess) {
      return Promise.reject(new Error("API Error"));
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  }

  if (!mockFetchSuccess) {
    return Promise.reject(new Error("API Error"));
  }
  if (mockNoReport) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: false, reason: "no_report" }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, action: "download", downloadUrl: "https://example.com/mock.pdf" }),
  });
};
const mockFetch = vi.fn(mockFetchImpl);
global.fetch = mockFetch as unknown as typeof fetch;

describe("AppraisalSection", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetchSuccess = true;
    errorOnAppraisalSubmit = false;
  });

  afterEach(() => {
    cleanup();
  });

  const fillForm = async () => {
    const addressInput = screen.getByPlaceholderText("Start typing your NZ address...");
    fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    try {
      const suggestionItems = screen.queryAllByText(/Queen Street/i) || [];
      
      if (suggestionItems.length > 0) {
        fireEvent.mouseDown(suggestionItems[0]);
      } else {
        fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });
      }
    } catch (e) {
      fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });
    }

    await act(async () => {
      await Promise.resolve();
    });

    const nextBtn = screen.queryByRole("button", { name: /Book Appraisal/i });
    
    if (nextBtn && nextBtn.getAttribute('disabled') === null) {
      fireEvent.click(nextBtn);
    }

    await act(async () => {
      await Promise.resolve();
    });

    const regionSelect = screen.getByLabelText(/Region/i) as HTMLSelectElement;
    const citySelect = screen.getByLabelText(/City \/ District/i) as HTMLSelectElement;
    const suburbSelect = screen.getByLabelText(/Suburb/i) as HTMLSelectElement;
    const nameInput = screen.getByPlaceholderText("e.g. John Doe");
    const emailInput = screen.getByPlaceholderText("e.g. john@example.com");
    const phoneInput = screen.getByPlaceholderText("e.g. +64 21 000 0000");
    const timelineSelect = screen.getByLabelText(/When are you looking to sell/i) as HTMLSelectElement;
    const motivationSelect = screen.getByLabelText(/Main reason for selling/i) as HTMLSelectElement;

    fireEvent.change(nameInput,        { target: { value: "Bob" } });
    fireEvent.change(emailInput,       { target: { value: "bob@example.com" } });
    fireEvent.change(phoneInput,       { target: { value: "12345" } });
    expect(regionSelect.value).toBe("Auckland");
    expect(citySelect.value).toBe("Auckland City");
    expect(suburbSelect.value).toBe("Auckland Central");
    fireEvent.change(timelineSelect,   { target: { value: "within-3-months" } });
    fireEvent.change(motivationSelect, { target: { value: "upsizing" } });
  };

  it("should render translations and handle inputs", async () => {
    render(<AppraisalSection lang="en" />);
    expect(screen.getByText("Unlock Your Property’s True Capital Value")).toBeDefined();

    await fillForm();

    const nameInput = screen.getByPlaceholderText("e.g. John Doe") as HTMLInputElement;
    expect(nameInput.value).toBe("Bob");
  });

  it("should submit form successfully and show modal", async () => {
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Send to Marie/i });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/appraisal", expect.any(Object));
      expect(screen.getByText("Thank you!")).toBeDefined();
    });

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      expect(screen.queryByText("Thank you!")).toBeNull();
    });
  });

  it("should update city and suburb options when the region changes", async () => {
    render(<AppraisalSection lang="en" />);
    await fillForm();

    const regionSelect = screen.getByLabelText(/Region/i);
    const citySelect = screen.getByLabelText(/City \/ District/i) as HTMLSelectElement;
    const suburbSelect = screen.getByLabelText(/Suburb/i) as HTMLSelectElement;

    fireEvent.change(regionSelect, { target: { value: "Wellington" } });

    expect(screen.getByRole("option", { name: "Wellington City" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "North Shore City" })).toBeNull();
    expect(citySelect.value).toBe("Wellington City");
    expect(suburbSelect.value).toBe("");
  });

  it("should handle error state when api fails", async () => {
    mockFetchSuccess = false;
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Send to Marie/i });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("An error occurred. Please try again.")).toBeDefined();
    });
  });

  it("should handle error response from api gracefully", async () => {
    errorOnAppraisalSubmit = true;
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Send to Marie/i });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("An error occurred. Please try again.")).toBeDefined();
    });
  });
});

describe("ReportDownloadSection", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetchSuccess = true;
    mockNoReport = false;
    mockFetch.mockImplementation(mockFetchImpl);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.warning).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should render translations and handle inputs", () => {
    render(<ReportDownloadSection lang="en" />);
    expect(screen.getByText("Access the Latest Auckland & North Shore Hyper-Local Market Report")).toBeDefined();

    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    expect((firstNameInput as HTMLInputElement).value).toBe("Jane");
  });

  it("should submit form successfully and trigger download", async () => {
    Object.defineProperty(window, "location", {
      value: { assign: vi.fn() },
      writable: true,
    });

    render(<ReportDownloadSection lang="en" />);
    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");
    const submitBtn = screen.getByRole("button", { name: /Download PDF Report/i });

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    fireEvent.click(submitBtn);

    // wait for async actions
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/reports/download", expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith("Thank you! Your download has started.", expect.any(Object));
  });

  it("should handle error state when api fails", async () => {
    mockFetchSuccess = false;
    render(<ReportDownloadSection lang="en" />);
    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");
    const submitBtn = screen.getByRole("button", { name: /Download PDF Report/i });

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve().catch(() => {});
    });

    expect(toast.error).toHaveBeenCalledWith("An error occurred. Please try again.", expect.any(Object));
  });

  it("shows in-progress message when the selected suburb has no report", async () => {
    mockNoReport = true;
    render(<ReportDownloadSection lang="en" />);
    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");
    const submitBtn = screen.getByRole("button", { name: /Download PDF Report/i });

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "The report for this suburb is currently being prepared. Please check back soon.",
        expect.any(Object)
      );
    });
    mockNoReport = false;
  });
});
