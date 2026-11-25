import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PropertyWorkspaceTabs } from '@/components/admin/PropertyWorkspaceTabs';

describe('PropertyWorkspaceTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('defaults to the Properties view and links to both pages', () => {
    render(<PropertyWorkspaceTabs />);

    const propertiesLink = screen.getByRole('link', { name: 'Properties' });
    const realestateLink = screen.getByRole('link', { name: 'Realestate' });

    expect(propertiesLink.getAttribute('href')).toBe('/admin/properties');
    expect(propertiesLink.getAttribute('aria-current')).toBe('page');
    expect(realestateLink.getAttribute('href')).toBe('/admin/realestate');
    expect(realestateLink.hasAttribute('aria-current')).toBe(false);
  });

  it('marks Realestate as selected on its page', () => {
    render(<PropertyWorkspaceTabs activeView="realestate" />);

    expect(screen.getByRole('link', { name: 'Realestate' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Properties' }).hasAttribute('aria-current')).toBe(false);
  });
});
