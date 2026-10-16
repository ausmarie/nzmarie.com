import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import EditModal, { EditFieldConfig } from "../../components/admin/EditModal";

describe("EditModal", () => {
  const mockOnClose = vi.fn();
  const mockOnDataChange = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  const baseProps = {
    isOpen: true,
    title: "Test Modal",
    data: {
      name: "John Doe",
      email: "john@example.com",
      age: 30,
      date: "2024-01-15",
      status: "active",
      notes: "Test notes",
    },
    onClose: mockOnClose,
    onDataChange: mockOnDataChange,
    onSave: mockOnSave,
    loading: false,
  };

  const textFields: EditFieldConfig[] = [
    { key: "name", label: "Name", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "age", label: "Age", type: "number" },
    { key: "date", label: "Date", type: "date" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <EditModal {...baseProps} isOpen={false} fields={textFields} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render modal with title when isOpen is true", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    expect(screen.getByText("Test Modal")).toBeTruthy();
  });

  it("should render all fields correctly", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Age")).toBeTruthy();
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("should populate input fields with data", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const inputs = screen.getAllByDisplayValue("John Doe");
    expect(inputs[0]).toBeTruthy();
  });

  it("should call onDataChange when text input changes", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const nameInput = screen.getByDisplayValue("John Doe") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Jane Doe" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("name", "Jane Doe");
  });

  it("should call onDataChange when email input changes", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const emailInput = screen.getByDisplayValue("john@example.com") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("email", "jane@example.com");
  });

  it("should call onDataChange when number input changes", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const ageInput = screen.getByDisplayValue("30") as HTMLInputElement;
    fireEvent.change(ageInput, { target: { value: "35" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("age", "35");
  });

  it("should call onDataChange when select input changes", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "inactive" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("status", "inactive");
  });

  it("should call onDataChange when textarea changes", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const textarea = screen.getByDisplayValue("Test notes") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Updated notes" } });
    expect(mockOnDataChange).toHaveBeenCalledWith("notes", "Updated notes");
  });

  it("should call onClose when Cancel button clicked", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should call onSave when Save Changes button clicked", async () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const saveButton = screen.getByText("Save Changes");
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("should disable buttons when loading is true", () => {
    render(<EditModal {...baseProps} loading={true} fields={textFields} />);
    const cancelButton = screen.getByText("Cancel") as HTMLButtonElement;
    const saveButton = screen.getByText("Saving...") as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
    expect(saveButton.disabled).toBe(true);
  });

  it("should show Saving... text when loading", () => {
    render(<EditModal {...baseProps} loading={true} fields={textFields} />);
    expect(screen.getByText("Saving...")).toBeTruthy();
  });

  it("should close modal when backdrop is clicked", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const backdrop = screen.getByText("Test Modal").parentElement?.previousElementSibling as HTMLElement;
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should not close modal when modal content is clicked", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const modalContent = screen.getByText("Test Modal").parentElement;
    fireEvent.click(modalContent!);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should render with custom maxWidth", () => {
    const { container } = render(
      <EditModal {...baseProps} maxWidth="900px" fields={textFields} />
    );
    const modal = container.querySelector('[style*="relative"]');
    expect(modal).toBeTruthy();
  });

  it("should handle empty data gracefully", () => {
    const { container } = render(
      <EditModal
        {...baseProps}
        data={{}}
        fields={textFields}
      />
    );
    expect(container).toBeTruthy();
  });

  it("should render required indicator when required is true", () => {
    const fieldsWithRequired: EditFieldConfig[] = [
      { key: "name", label: "Name", type: "text", required: true },
    ];
    render(
      <EditModal {...baseProps} fields={fieldsWithRequired} />
    );
    const requiredIndicator = screen.getByText("*");
    expect(requiredIndicator).toBeTruthy();
  });

  it("should render select with correct options", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[0] as HTMLSelectElement;
    const options = Array.from(statusSelect.options);
    expect(options.some(opt => opt.value === "active")).toBe(true);
    expect(options.some(opt => opt.value === "inactive")).toBe(true);
  });

  it("should handle multiple textarea fields", () => {
    const multiTextareaFields: EditFieldConfig[] = [
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "details", label: "Details", type: "textarea" },
    ];
    const data = { summary: "Test summary", details: "Test details" };
    render(
      <EditModal
        {...baseProps}
        data={data}
        fields={multiTextareaFields}
      />
    );
    expect(screen.getByDisplayValue("Test summary")).toBeTruthy();
    expect(screen.getByDisplayValue("Test details")).toBeTruthy();
  });

  it("should render date input with correct value", () => {
    render(<EditModal {...baseProps} fields={textFields} />);
    const dateInput = screen.getByDisplayValue("2024-01-15") as HTMLInputElement;
    expect(dateInput.type).toBe("date");
  });
});
