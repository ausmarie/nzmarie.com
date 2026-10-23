import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import LeadPdfSection from '@/components/admin/LeadPdfSection';

describe('LeadPdfSection', () => {
  afterEach(() => cleanup());

  it('passes selected PDF files to the upload handler', () => {
    const onUpload = vi.fn();
    const { container } = render(
      <LeadPdfSection documents={[]} onUpload={onUpload} onDelete={vi.fn()} />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'appraisal.pdf', {
      type: 'application/pdf',
    });
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [pdf, text] } });

    expect(onUpload).toHaveBeenCalledWith([pdf]);
  });

  it('lists document history and exposes view and delete actions', () => {
    const onDelete = vi.fn();
    render(
      <LeadPdfSection
        documents={[
          {
            id: 'document-1',
            lead_id: 'lead-1',
            doc_type: 'appraisal_pdf',
            file_name: 'appraisal.pdf',
            file_url: 'https://reports.nzmarie.com/appraisal.pdf',
            file_size: 2048,
            mime_type: 'application/pdf',
            created_at: '2026-10-21T00:00:00.000Z',
          },
        ]}
        onUpload={vi.fn()}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('appraisal.pdf')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
    expect(screen.getByRole('link', { name: /View/i }).getAttribute('href')).toBe(
      'https://reports.nzmarie.com/appraisal.pdf'
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'document-1', file_name: 'appraisal.pdf' })
    );
  });
});
