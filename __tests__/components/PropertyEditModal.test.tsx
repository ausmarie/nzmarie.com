import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import PropertyEditModal from "../../components/admin/PropertyEditModal";

describe("PropertyEditModal", () => {
  const mockOnClose = vi.fn();
  const mockOnDataChange = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  const propertyData = {
    address: "123 Main Street",
    suburb: "Downtown",
    city: "Auckland",
    region: "Auckland",
    postcode: "1010",
    bedrooms: 3,
    bathrooms: 2,
    car_spaces: 2,
    year_built: 2010,
    floor_size: "180",
    land_area: "400",
    last_sold_price: 850000,
    last_sold_date: "2020-06-15",
    capital_value: 900000,
    property_url: "https://example.com/property",
    cover_image_url: "https://example.com/image.jpg",
    description: "Beautiful property in prime location",
  };

  const baseProps = {
    isOpen: true,
    data: propertyData,
    onClose: mockOnClose,
    onDataChange: mockOnDataChange,
    onSave: mockOnSave,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render PropertyEditModal when isOpen is true", () => {
    render(<PropertyEditModal {...baseProps} propertyAddress="123 Main St" />);
    expect(screen.getByText("Edit Property - 123 Main St")).toBeTruthy();
  });

  it("should use default property address text when not provided", () => {
    render(<PropertyEditModal {...baseProps} />);
    expect(screen.getByText("Edit Property - Property")).toBeTruthy();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <PropertyEditModal {...baseProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render all property edit fields", () => {
    render(<PropertyEditModal {...baseProps} />);
    expect(screen.getByText("Address")).toBeTruthy();
    expect(screen.getByText("Suburb")).toBeTruthy();
    expect(screen.getByText("City")).toBeTruthy();
    expect(screen.getByText("Region")).toBeTruthy();
    expect(screen.getByText("Postcode")).toBeTruthy();
    expect(screen.getByText("Bedrooms")).toBeTruthy();
    expect(screen.getByText("Bathrooms")).toBeTruthy();
    expect(screen.getByText("Car Spaces")).toBeTruthy();
    expect(screen.getByText("Year Built")).toBeTruthy();
    expect(screen.getByText("Floor Size (m²)")).toBeTruthy();
    expect(screen.getByText("Land Area")).toBeTruthy();
    expect(screen.getByText("Last Sold Price")).toBeTruthy();
    expect(screen.getByText("Last Sold Date")).toBeTruthy();
    expect(screen.getByText("Capital Value (RV)")).toBeTruthy();
    expect(screen.getByText("Property URL")).toBeTruthy();
    expect(screen.getByText("Cover Image URL")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
  });

  it("should populate fields with property data", () => {
    render(<PropertyEditModal {...baseProps} />);
    expect(screen.getByDisplayValue("123 Main Street")).toBeTruthy();
    expect(screen.getByDisplayValue("Downtown")).toBeTruthy();
    expect(screen.getByDisplayValue("1010")).toBeTruthy();
    expect(screen.getByDisplayValue("Beautiful property in prime location")).toBeTruthy();
  });

  it("should call onDataChange when address changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const addressInput = screen.getByDisplayValue("123 Main Street") as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: "456 Elm Street" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("address", "456 Elm Street");
  });

  it("should call onDataChange when suburb changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const suburbInput = screen.getByDisplayValue("Downtown") as HTMLInputElement;
    fireEvent.change(suburbInput, { target: { value: "Uptown" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("suburb", "Uptown");
  });

  it("should call onDataChange when bedrooms changes", () => {
    const { container } = render(<PropertyEditModal {...baseProps} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    const bedroomsInput = Array.from(inputs).find(el => (el as HTMLInputElement).value === "3") as HTMLInputElement;
    fireEvent.change(bedroomsInput, { target: { value: "4" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("bedrooms", "4");
  });

  it("should call onDataChange when bathrooms changes", () => {
    const { container } = render(<PropertyEditModal {...baseProps} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    const bathroomsInputs = Array.from(inputs).filter(el => (el as HTMLInputElement).value === "2");
    const bathroomsInput = bathroomsInputs[0] as HTMLInputElement;
    fireEvent.change(bathroomsInput, { target: { value: "3" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("bathrooms", "3");
  });

  it("should call onDataChange when year built changes", () => {
    const { container } = render(<PropertyEditModal {...baseProps} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    const yearInputs = Array.from(inputs).filter(el => (el as HTMLInputElement).value === "2010");
    const yearInput = yearInputs[0] as HTMLInputElement;
    fireEvent.change(yearInput, { target: { value: "2015" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("year_built", "2015");
  });

  it("should call onDataChange when description changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const descriptionTextarea = screen.getByDisplayValue("Beautiful property in prime location") as HTMLTextAreaElement;
    fireEvent.change(descriptionTextarea, { target: { value: "Updated description" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("description", "Updated description");
  });

  it("should call onDataChange when last sold date changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const dateInput = screen.getByDisplayValue("2020-06-15") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2021-06-15" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("last_sold_date", "2021-06-15");
  });

  it("should call onSave when Save button is clicked", async () => {
    render(<PropertyEditModal {...baseProps} />);
    const saveButton = screen.getByText("Save Changes");
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("should call onClose when Cancel button is clicked", () => {
    render(<PropertyEditModal {...baseProps} />);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should show loading state when loading is true", () => {
    render(<PropertyEditModal {...baseProps} loading={true} />);
    expect(screen.getByText("Saving...")).toBeTruthy();
  });

  it("should disable buttons when loading", () => {
    render(<PropertyEditModal {...baseProps} loading={true} />);
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    buttons.forEach(button => {
      expect(button.disabled).toBe(true);
    });
  });

  it("should render with custom maxWidth", () => {
    const { container } = render(
      <PropertyEditModal {...baseProps} maxWidth="800px" />
    );
    expect(container).toBeTruthy();
  });

  it("should call onDataChange when property URL changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const urlInput = screen.getByDisplayValue("https://example.com/property") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/property2" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("property_url", "https://example.com/property2");
  });

  it("should call onDataChange when cover image URL changes", () => {
    render(<PropertyEditModal {...baseProps} />);
    const imageUrlInput = screen.getByDisplayValue("https://example.com/image.jpg") as HTMLInputElement;
    fireEvent.change(imageUrlInput, { target: { value: "https://example.com/image2.jpg" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("cover_image_url", "https://example.com/image2.jpg");
  });

  it("should call onDataChange when floor size changes", () => {
    const { container } = render(<PropertyEditModal {...baseProps} />);
    const inputs = container.querySelectorAll('input[type="text"]');
    const floorSizeInputs = Array.from(inputs).filter(el => (el as HTMLInputElement).value === "180");
    const floorSizeInput = floorSizeInputs[0] as HTMLInputElement;
    fireEvent.change(floorSizeInput, { target: { value: "200" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("floor_size", "200");
  });

  it("should call onDataChange when capital value changes", () => {
    const { container } = render(<PropertyEditModal {...baseProps} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    const capitalValueInputs = Array.from(inputs).filter(el => (el as HTMLInputElement).value === "900000");
    const capitalValueInput = capitalValueInputs[0] as HTMLInputElement;
    fireEvent.change(capitalValueInput, { target: { value: "950000" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("capital_value", "950000");
  });

  it("should show 'Edit Property' title not 'Edit Lead'", () => {
    render(<PropertyEditModal {...baseProps} propertyAddress="123 Main St" />);
    expect(screen.getByText("Edit Property - 123 Main St")).toBeTruthy();
    expect(screen.queryByText("Edit Lead")).toBeNull();
  });

  it("should render property-specific fields not in LeadEditModal", () => {
    render(<PropertyEditModal {...baseProps} />);
    expect(screen.getByText("Postcode")).toBeTruthy();
    expect(screen.getByText("Car Spaces")).toBeTruthy();
    expect(screen.getByText("Capital Value (RV)")).toBeTruthy();
    expect(screen.getByText("Floor Size (m²)")).toBeTruthy();
    expect(screen.getByText("Cover Image URL")).toBeTruthy();
  });

  it("should use 'address' key for property address", () => {
    const dataWithAddress = { ...propertyData, address: "123 Main Street" };
    render(<PropertyEditModal {...baseProps} data={dataWithAddress} />);
    expect(screen.getByDisplayValue("123 Main Street")).toBeTruthy();
  });

  it("should NOT render lead-specific fields (next_action, owner_name, status select, priority select)", () => {
    render(<PropertyEditModal {...baseProps} />);
    expect(screen.queryByText("Next Action")).toBeNull();
    expect(screen.queryByText("Next Action Date")).toBeNull();
    expect(screen.queryByText("Owner Name")).toBeNull();
    expect(screen.queryByText("Owner Email")).toBeNull();
    expect(screen.queryByText("Owner Phone")).toBeNull();
  });

  it("should render property history section", () => {
    const dataWithHistory = { ...propertyData, property_history: "Sold 2020" };
    render(<PropertyEditModal {...baseProps} data={dataWithHistory} />);
    expect(screen.getByText("Property History")).toBeTruthy();
  });
});
