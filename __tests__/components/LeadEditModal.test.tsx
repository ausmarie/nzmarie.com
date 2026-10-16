import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import LeadEditModal from "../../components/admin/LeadEditModal";

describe("LeadEditModal", () => {
  const mockOnClose = vi.fn();
  const mockOnDataChange = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  const leadData = {
    owner_name: "John Doe",
    owner_email: "john@example.com",
    owner_phone: "555-1234",
    status: "new",
    priority: "high",
    summary: "Interested in property",
    notes: "Follow up next week",
    next_action: "Call owner",
    next_action_at: "2024-02-01",
  };

  const baseProps = {
    isOpen: true,
    data: leadData,
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

  it("should render LeadEditModal when isOpen is true", () => {
    render(<LeadEditModal {...baseProps} leadAddress="123 Main St" />);
    expect(screen.getByText("Edit Lead - 123 Main St")).toBeTruthy();
  });

  it("should use default lead address text when not provided", () => {
    render(<LeadEditModal {...baseProps} />);
    expect(screen.getByText("Edit Lead - Lead")).toBeTruthy();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <LeadEditModal {...baseProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render all lead edit fields", () => {
    render(<LeadEditModal {...baseProps} />);
    expect(screen.getByText("Owner Name")).toBeTruthy();
    expect(screen.getByText("Owner Email")).toBeTruthy();
    expect(screen.getByText("Owner Phone")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
    expect(screen.getByText("Next Action")).toBeTruthy();
    expect(screen.getByText("Next Action Date")).toBeTruthy();
    // Should NOT show property-only fields
    expect(screen.queryByText("Bedrooms")).toBeNull();
    expect(screen.queryByText("Bathrooms")).toBeNull();
    expect(screen.queryByText("Year Built")).toBeNull();
  });

  it("should populate fields with lead data", () => {
    render(<LeadEditModal {...baseProps} />);
    expect(screen.getByDisplayValue("John Doe")).toBeTruthy();
    expect(screen.getByDisplayValue("john@example.com")).toBeTruthy();
    expect(screen.getByDisplayValue("555-1234")).toBeTruthy();
    expect(screen.getByDisplayValue("Interested in property")).toBeTruthy();
  });

  it("should call onDataChange when owner name changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const nameInput = screen.getByDisplayValue("John Doe") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Jane Doe" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("owner_name", "Jane Doe");
  });

  it("should call onDataChange when owner email changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const emailInput = screen.getByDisplayValue("john@example.com") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("owner_email", "jane@example.com");
  });

  it("should call onDataChange when status changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const statusSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "contacted" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("status", "contacted");
  });

  it("should call onDataChange when priority changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const selects = screen.getAllByRole("combobox");
    const prioritySelect = selects[1] as HTMLSelectElement;
    fireEvent.change(prioritySelect, { target: { value: "low" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("priority", "low");
  });

  it("should call onSave when Save button is clicked", async () => {
    render(<LeadEditModal {...baseProps} />);
    const saveButton = screen.getByText("Save Changes");
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("should call onClose when Cancel button is clicked", () => {
    render(<LeadEditModal {...baseProps} />);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should show loading state when loading is true", () => {
    render(<LeadEditModal {...baseProps} loading={true} />);
    expect(screen.getByText("Saving...")).toBeTruthy();
  });

  it("should have all status options available", () => {
    render(<LeadEditModal {...baseProps} />);
    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[0] as HTMLSelectElement;
    const options = Array.from(statusSelect.options).map(opt => opt.value);
    expect(options).toContain("new");
    expect(options).toContain("contacted");
    expect(options).toContain("appointment_scheduled");
    expect(options).toContain("appraised");
    expect(options).toContain("converted");
    expect(options).toContain("lost");
  });

  it("should have all priority options available", () => {
    render(<LeadEditModal {...baseProps} />);
    const prioritySelects = screen.getAllByRole("combobox");
    const prioritySelect = prioritySelects.find(el => 
      Array.from((el as HTMLSelectElement).options).some(opt => opt.value === "low")
    ) as HTMLSelectElement;
    const options = Array.from(prioritySelect.options).map(opt => opt.value);
    expect(options).toContain("low");
    expect(options).toContain("medium");
    expect(options).toContain("high");
  });

  it("should call onDataChange when notes textarea changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const notesTextarea = screen.getByDisplayValue("Follow up next week") as HTMLTextAreaElement;
    fireEvent.change(notesTextarea, { target: { value: "Updated notes" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("notes", "Updated notes");
  });

  it("should call onDataChange when next action date changes", () => {
    render(<LeadEditModal {...baseProps} />);
    const dateInput = screen.getByDisplayValue("2024-02-01") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2024-02-15" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("next_action_at", "2024-02-15");
  });

  it("should disable buttons when loading", () => {
    render(<LeadEditModal {...baseProps} loading={true} />);
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    buttons.forEach(button => {
      expect(button.disabled).toBe(true);
    });
  });

  it("should render with custom maxWidth", () => {
    const { container } = render(
      <LeadEditModal {...baseProps} maxWidth="800px" />
    );
    expect(container).toBeTruthy();
  });

  it("should show 'Edit Lead' title not 'Edit Property'", () => {
    render(<LeadEditModal {...baseProps} leadAddress="123 Main St" />);
    expect(screen.getByText("Edit Lead - 123 Main St")).toBeTruthy();
    expect(screen.queryByText("Edit Property")).toBeNull();
  });

  it("should render address field as property_address key", () => {
    const dataWithAddress = { ...leadData, property_address: "2/23 Sartors Avenue" };
    render(<LeadEditModal {...baseProps} data={dataWithAddress} />);
    expect(screen.getByDisplayValue("2/23 Sartors Avenue")).toBeTruthy();
  });

  it("should NOT render property-specific fields (postcode, car_spaces, capital_value)", () => {
    render(<LeadEditModal {...baseProps} />);
    expect(screen.queryByText("Postcode")).toBeNull();
    expect(screen.queryByText("Car Spaces")).toBeNull();
    expect(screen.queryByText("Capital Value (RV)")).toBeNull();
    expect(screen.queryByText("Floor Size (m²)")).toBeNull();
    expect(screen.queryByText("Last Sold Price")).toBeNull();
    expect(screen.queryByText("Cover Image URL")).toBeNull();
  });

  it("should render lead-specific fields", () => {
    render(<LeadEditModal {...baseProps} />);
    expect(screen.getByText("Next Action")).toBeTruthy();
    expect(screen.getByText("Next Action Date")).toBeTruthy();
    expect(screen.getByText("Owner Name")).toBeTruthy();
    expect(screen.getByText("Owner Email")).toBeTruthy();
    expect(screen.getByText("Owner Phone")).toBeTruthy();
  });

  it("should render status and priority as select dropdowns", () => {
    render(<LeadEditModal {...baseProps} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

});
