import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PropertyListings from "../../components/PropertyListings";

describe("PropertyListings - 2/21 Birdwood Crescent, Parnell, Auckland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the new property card for 2/21 Birdwood Crescent, Parnell, Auckland", async () => {
    render(<PropertyListings lang="en" />);

    // Check if the new property card is rendered
    await waitFor(() => {
      const title = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland");
      expect(title).toBeTruthy();
    });

    // Check property details - use the card context to be more specific
    const card = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland").closest(".property-card") as HTMLElement;
    expect(within(card).getByText("Securing Premium Parnell Living")).toBeTruthy();
    expect(within(card).getByText("4 Bedrooms")).toBeTruthy();
    expect(within(card).getByText("3 Bathrooms")).toBeTruthy();
    expect(within(card).getByText("2 Parking")).toBeTruthy();
    expect(within(card).getByText("Floor Area 248m²")).toBeTruthy();
    expect(within(card).getByText("Land Area 285m²")).toBeTruthy();
    expect(within(card).getByText("Townhouse")).toBeTruthy();
  });

  it("displays Chinese translation when lang='zh'", async () => {
    render(<PropertyListings lang="zh" />);

    await waitFor(() => {
      const title = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland");
      expect(title).toBeTruthy();
    });

    const card = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland").closest(".property-card") as HTMLElement;
    expect(within(card).getAllByText("已售").length).toBeGreaterThan(0);
    expect(within(card).getByText("锁定优质帕内尔生活")).toBeTruthy();
    expect(within(card).getByText("4 卧室")).toBeTruthy();
    expect(within(card).getByText("3 卫浴")).toBeTruthy();
    expect(within(card).getByText("2 车位")).toBeTruthy();
    expect(within(card).getByText("室内面积 248m²")).toBeTruthy();
    expect(within(card).getByText("土地面积 285m²")).toBeTruthy();
    // propertyType is displayed directly from data, not translated
    expect(within(card).getByText("Townhouse")).toBeTruthy();
  });

  it("displays the property image", async () => {
    render(<PropertyListings lang="en" />);

    await waitFor(() => {
      const img = screen.getByAltText("2/21 Birdwood Crescent, Parnell, Auckland");
      expect(img).toBeTruthy();
      expect(img.getAttribute("src")).toContain("%2Fimg%2F2-21%20Birdwood%20Crescent%2F3572532814289677914.jpg");
    });
  });

  it("shows image carousel arrows for properties with multiple images", async () => {
    render(<PropertyListings lang="en" />);

    await waitFor(() => {
      const card = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland").closest(".property-card") as HTMLElement;
      // Check for carousel arrows (card-specific labels)
      const prevArrow = within(card).getByRole("button", { name: /Card previous image/i });
      const nextArrow = within(card).getByRole("button", { name: /Card next image/i });
      expect(prevArrow).toBeTruthy();
      expect(nextArrow).toBeTruthy();
    });
  });

  it("cycles through images when clicking carousel arrows", async () => {
    render(<PropertyListings lang="en" />);

    await waitFor(() => {
      const card = screen.getByText("2/21 Birdwood Crescent, Parnell, Auckland").closest(".property-card") as HTMLElement;
      const img = within(card).getByAltText("2/21 Birdwood Crescent, Parnell, Auckland");
      const initialSrc = img.getAttribute("src");
      
      // Click next arrow
      const nextArrow = within(card).getByRole("button", { name: /Card next image/i });
      fireEvent.click(nextArrow);
      
      // Image should change
      expect(img.getAttribute("src")).not.toBe(initialSrc);
    });
  });

  it("shows the full Birdwood address in property details", async () => {
    render(<PropertyListings lang="en" />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByRole("button", { name: /View Details/i })[0]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "2/21 Birdwood Crescent, Parnell, Auckland",
        })
      ).toBeTruthy();
      expect(
        screen.getAllByText("2/21 Birdwood Crescent, Parnell, Auckland")
      ).toHaveLength(3);
    });
  });
});