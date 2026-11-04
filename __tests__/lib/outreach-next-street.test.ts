import { describe, expect, it } from 'vitest';
import { findNextUnsentStreet } from '@/lib/outreach-next-street';

describe('findNextUnsentStreet', () => {
  it('returns the next available street in walking order', () => {
    expect(
      findNextUnsentStreet(
        ['Ashley Avenue', 'Glenvar Road', 'Ian Sage Avenue'],
        'Ashley Avenue',
        ['Glenvar Road', 'Ian Sage Avenue']
      )
    ).toBe('Glenvar Road');
  });

  it('skips streets that are no longer available', () => {
    expect(
      findNextUnsentStreet(
        ['Ashley Avenue', 'Glenvar Road', 'Ian Sage Avenue'],
        'Ashley Avenue',
        ['Ian Sage Avenue']
      )
    ).toBe('Ian Sage Avenue');
  });

  it('wraps to the first remaining street when the completed street is last', () => {
    expect(
      findNextUnsentStreet(
        ['Ashley Avenue', 'Glenvar Road', 'Ian Sage Avenue'],
        'Ian Sage Avenue',
        ['Ashley Avenue', 'Glenvar Road']
      )
    ).toBe('Ashley Avenue');
  });

  it('returns null when the completed street is absent or no streets remain', () => {
    expect(findNextUnsentStreet(['Ashley Avenue'], 'Ashley Avenue', [])).toBeNull();
    expect(findNextUnsentStreet(['Ashley Avenue'], 'Unknown Road', ['Ashley Avenue'])).toBeNull();
  });
});
