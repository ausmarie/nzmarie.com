import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SentDateFilter from '../../app/admin/outreach/components/SentDateFilter';

describe('SentDateFilter', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders quick preset buttons and calendar toggle', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yesterday' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This Week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toggle calendar' })).toBeTruthy();
    expect(screen.getByText('All dates')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Previous month' })).toBeNull();
  });

  it('reveals the monthly calendar after clicking Pick Dates', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    expect(screen.queryByRole('button', { name: 'Previous month' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle calendar' }));
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
  });

  it('selects today when Today preset clicked', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    expect(mockOnChange).toHaveBeenCalledWith([`${y}-${m}-${d}`]);
  });

  it('highlights Today as selected when dates equal today', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    render(<SentDateFilter dates={[`${y}-${m}-${d}`]} onChange={mockOnChange} />);
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Yesterday' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('selects 7 dates for This Week preset', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const dates = mockOnChange.mock.calls[0][0] as string[];
    expect(dates).toHaveLength(7);
  });

  it('toggles an individual calendar date', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle calendar' }));
    const dayButtons = screen.getAllByRole('button', { name: /Toggle 20/ });
    expect(dayButtons.length).toBeGreaterThan(0);
    fireEvent.click(dayButtons[0]);
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const dates = mockOnChange.mock.calls[0][0] as string[];
    expect(dates).toHaveLength(1);
  });

  it('removes a date when an already-selected calendar day is clicked', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dateStr = `${y}-${m}-15`;
    const selected = [dateStr];
    render(<SentDateFilter dates={selected} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle calendar' }));
    fireEvent.click(screen.getByRole('button', { name: `Toggle ${dateStr}` }));
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('clears all dates via Clear preset', () => {
    render(<SentDateFilter dates={['2026-08-15', '2026-08-16']} onChange={mockOnChange} />);
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('navigates months with previous/next buttons', () => {
    render(<SentDateFilter dates={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle calendar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('All dates')).toBeTruthy();
  });
});
