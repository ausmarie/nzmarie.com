import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import AboutMarieEditor from '../../app/admin/reports/components/AboutMarieEditor';

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { width: _w, height: _h, unoptimized: _u, ...safeProps } = rest as {
      width?: unknown; height?: unknown; unoptimized?: unknown; [key: string]: unknown;
    };
    return <img src={src} alt={alt} {...(safeProps as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock('../../app/admin/reports/stores/report-store', () => ({
  useReportStore: () => ({
    setIsSaving: vi.fn(),
    setLastSaved: vi.fn(),
    updateDocument: vi.fn(),
  }),
}));

const defaultProps = {
  docId: 'test-doc-id',
  initialContent: null,
  onContentChange: vi.fn(),
};

describe('AboutMarieEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Preview mode (default)', () => {
    it('renders the preview mode by default', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      expect(screen.getByText('Preview')).toBeTruthy();
      expect(screen.getByText('Edit Content')).toBeTruthy();
      expect(screen.getByText('A Personal Note from Marie')).toBeTruthy();
    });

    it('displays LICENSED UNDER REAA 2008 text', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      expect(screen.getByText(/licensed under reaa 2008/i)).toBeTruthy();
    });

    it('does not show QR code when showQrCode is false (default)', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      expect(screen.queryByAltText('QR Code')).toBeNull();
    });

    it('shows QR code in preview when showQrCode is true and qrCodeUrl is set', () => {
      const content = {
        custom: true,
        title: 'A Personal Note from Marie',
        subtitle: 'Bespoke Consultancy',
        welcomeText: 'Hi',
        paragraphs: [],
        phone: '021',
        email: 'test@test.com',
        website: 'nzmarie.com',
        location: 'Auckland',
        license: 'REAA 2008',
        appraisalTitle: 'How a Free Appraisal Works',
        steps: [],
        websiteCtaPrefix: 'Visit ',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      const qrImg = screen.getByAltText(/QR Code/i);
      expect(qrImg).toBeTruthy();
      expect((qrImg as HTMLImageElement).src).toContain('example.com/qr.png');
    });

    it('does not show QR code when showQrCode is true but qrCodeUrl is empty', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: '',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      expect(screen.queryByAltText('QR Code')).toBeNull();
    });

    it('shows "Scan to visit" label when QR code is displayed', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      expect(screen.getByText('Scan to visit')).toBeTruthy();
    });

    it('QR code is positioned in the left column (am-left), not the right column', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: 'How a Free Appraisal Works',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      const qrWrapper = screen.getByAltText(/QR Code/i).closest('#am-qrcode');
      const leftCol = document.getElementById('am-left');
      expect(leftCol).toBeTruthy();
      expect(leftCol!.contains(qrWrapper)).toBe(true);
    });
  });

  describe('Edit mode', () => {
    it('switches to edit mode when Edit Content button is clicked', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByText('Edit About Marie')).toBeTruthy();
    });

    it('renders the QR Code section in edit mode', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByText('QR Code')).toBeTruthy();
      expect(screen.getByText('Show on page')).toBeTruthy();
      expect(screen.getByText('Upload QR Code Image')).toBeTruthy();
    });

    it('QR toggle checkbox is unchecked by default', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      const toggle = screen.getByTestId('qr-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);
    });

    it('QR toggle checkbox is checked when initialContent has showQrCode: true', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));
      const toggle = screen.getByTestId('qr-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    it('toggles showQrCode state when checkbox is clicked', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      const toggle = screen.getByTestId('qr-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(false);
    });

    it('does not show preview image in edit mode when no QR URL is set', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.queryByTestId('qr-preview')).toBeNull();
    });

    it('shows preview image in edit mode when qrCodeUrl is set in initialContent', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByTestId('qr-preview')).toBeTruthy();
      expect(screen.getByAltText('QR Code Preview')).toBeTruthy();
    });

    it('shows the qrCodeUrl in the URL display field', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByTestId('qr-url-display').textContent).toBe('https://example.com/qr.png');
    });

    it('shows uploading state and local preview when a file is selected', async () => {
      const uploadResponse = { success: true, url: 'https://r2.nzmarie.com/about-marie/qrcode.png' };
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(uploadResponse),
      });

      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));

      const file = new File(['fake-image'], 'qrcode.png', { type: 'image/png' });
      const input = screen.getByTestId('qr-file-input');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('sets the uploaded URL after successful upload', async () => {
      const uploadUrl = 'https://r2.nzmarie.com/about-marie/qrcode.png';
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, url: uploadUrl }),
      });

      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));

      const file = new File(['fake-image'], 'qrcode.png', { type: 'image/png' });
      const input = screen.getByTestId('qr-file-input');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('qr-url-display').textContent).toBe(uploadUrl);
      });
    });

    it('calls fetch with correct endpoint on QR upload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, url: 'https://r2.nzmarie.com/about-marie/qrcode.png' }),
      });

      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));

      const file = new File(['fake-image'], 'qrcode.png', { type: 'image/png' });
      const input = screen.getByTestId('qr-file-input');

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
        const uploadCall = calls.find((c: unknown[]) => String(c[0]).includes('about-marie-qr'));
        expect(uploadCall).toBeTruthy();
        expect((uploadCall![1] as RequestInit).method).toBe('POST');
      });
    });
  });

  describe('QR code remove and re-upload', () => {
    it('shows Remove button when a QR URL is present', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByTestId('qr-remove-btn')).toBeTruthy();
    });

    it('removes QR code URL and hides preview when Remove is clicked', () => {
      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.getByTestId('qr-preview')).toBeTruthy();
      fireEvent.click(screen.getByTestId('qr-remove-btn'));
      expect(screen.queryByTestId('qr-preview')).toBeNull();
      expect(screen.queryByTestId('qr-url-display')).toBeNull();
    });

    it('does not show Remove button when no QR URL is set', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      expect(screen.queryByTestId('qr-remove-btn')).toBeNull();
    });

    it('allows re-upload after removal', async () => {
      const uploadUrl = 'https://r2.nzmarie.com/about-marie/qrcode.png';
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, url: uploadUrl }),
      });

      const content = {
        custom: true,
        title: 'Test',
        subtitle: '',
        welcomeText: '',
        paragraphs: [],
        phone: '',
        email: '',
        website: '',
        location: '',
        license: '',
        appraisalTitle: '',
        steps: [],
        websiteCtaPrefix: '',
        disclaimer1: '',
        disclaimer2: '',
        disclaimer3: '',
        showQrCode: true,
        qrCodeUrl: 'https://example.com/old-qr.png',
      };
      render(<AboutMarieEditor {...defaultProps} initialContent={content} />);
      fireEvent.click(screen.getByText('Edit Content'));

      fireEvent.click(screen.getByTestId('qr-remove-btn'));
      expect(screen.queryByTestId('qr-preview')).toBeNull();

      const file = new File(['fake-image'], 'new-qr.png', { type: 'image/png' });
      const input = screen.getByTestId('qr-file-input');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId('qr-url-display').textContent).toBe(uploadUrl);
      });
    });
  });

  describe('API route: about-marie-qr', () => {
    it('file input accepts image/* types', () => {
      render(<AboutMarieEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit Content'));
      const input = screen.getByTestId('qr-file-input') as HTMLInputElement;
      expect(input.accept).toBe('image/*');
    });
  });
});
