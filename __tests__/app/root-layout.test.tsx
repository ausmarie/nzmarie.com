import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import RootLayout from '../../app/layout';

vi.mock('next/font/google', () => ({
  Poppins: () => ({ className: 'poppins-mock' }),
}));

vi.mock('../../app/ClientLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe('RootLayout hydration tolerance', () => {
  it('sets suppressHydrationWarning on the body element', () => {
    const tree = RootLayout({ children: React.createElement('div') }) as React.ReactElement<any>;

    const children = React.Children.toArray(tree.props.children) as React.ReactElement<any>[];
    const body = children.find((el) => el.type === 'body');

    expect(body).toBeTruthy();
    expect(body!.props.suppressHydrationWarning).toBe(true);
  });

  it('renders ClientLayout inside body', () => {
    const tree = RootLayout({ children: React.createElement('span', null, 'child') }) as React.ReactElement<any>;

    const children = React.Children.toArray(tree.props.children) as React.ReactElement<any>[];
    const body = children.find((el) => el.type === 'body')!;
    const clientLayout = React.Children.toArray(body.props.children)[0] as React.ReactElement<any>;

    expect(clientLayout).toBeTruthy();
    const inner = React.Children.toArray(clientLayout.props.children)[0] as React.ReactElement<any>;
    expect(inner.type).toBe('span');
    expect(inner.props.children).toBe('child');
  });
});
