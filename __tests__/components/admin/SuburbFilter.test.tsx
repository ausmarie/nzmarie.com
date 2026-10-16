import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SuburbFilter } from '@/components/admin/SuburbFilter';

describe('SuburbFilter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select element', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="all" onChange={handleChange} />
    );

    const select = container.querySelector('select');
    expect(select).toBeDefined();
  });

  it('renders suburb options', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="all" onChange={handleChange} />
    );

    const select = container.querySelector('select');
    const options = select?.querySelectorAll('option');
    
    expect(options?.length).toBeGreaterThan(5);
  });

  it('includes Other option', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="all" onChange={handleChange} />
    );

    const otherOption = Array.from(container.querySelectorAll('option')).find(
      opt => opt.textContent === 'Other'
    );
    
    expect(otherOption).toBeDefined();
  });

  it('displays label when showLabel is true', () => {
    const handleChange = vi.fn();
    render(
      <SuburbFilter 
        value="all" 
        onChange={handleChange}
        showLabel={true}
        label="Select Suburb"
      />
    );

    expect(screen.getByText('Select Suburb:')).toBeDefined();
  });

  it('calls onChange when suburb is selected', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="all" onChange={handleChange} />
    );

    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Takapuna' } });

    expect(handleChange).toHaveBeenCalledWith('Takapuna');
  });

  it('renders with selected value', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="Albany" onChange={handleChange} />
    );

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('Albany');
  });

  it('includes all major suburbs', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <SuburbFilter value="all" onChange={handleChange} />
    );

    const select = container.querySelector('select');
    const options = Array.from(select?.querySelectorAll('option') || []);
    const optionTexts = options.map(opt => opt.textContent);

    expect(optionTexts).toContain('Takapuna');
    expect(optionTexts).toContain('Albany');
    expect(optionTexts).toContain('Northcross');
  });
});
