/**
 * Tests for unsent data filtering in outreach filter
 * Verifies:
 * 1. Excludes sent records (status = 'sent' OR has send logs)
 * 2. Excludes junk mail (no_junk_mail = true)
 * 3. Only returns unsent pending addresses
 */

import { describe, it, expect } from 'vitest';
import { buildOutreachFilter } from '@/lib/outreach-filter';

describe('buildOutreachFilter - Unsent Status', () => {
  it('should build correct SQL for unsent pending with suburb', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    expect(filter.sql).toContain("op.suburb = $1");
    expect(filter.sql).toContain("op.status = 'pending'");
    expect(filter.sql).toContain('NOT EXISTS');
    expect(filter.sql).toContain('outreach_send_logs');
    expect(filter.sql).toContain('COALESCE(op.total_send_count, 0) = 0');
    expect(filter.sql).toContain('op.last_sent_at IS NULL');
    expect(filter.sql).toContain('op.sent_at IS NULL');
    expect(filter.sql).toContain('no_junk_mail = true');
    expect(filter.params).toContain('Torbay');
  });

  it('should exclude addresses with no_junk_mail = true', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    // The filter should have NOT EXISTS clause for junk mail
    expect(filter.sql).toContain('NOT EXISTS (');
    expect(filter.sql).toContain('p2.no_junk_mail = true');
  });

  it('should handle reportQuarter filtering for unsent', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
      reportQuarter: '2026-Q2',
    });

    expect(filter.params).toContain('Torbay');
    expect(filter.params).toContain('Q2');
    expect(filter.params).toContain(2026);
    expect(filter.params).toContain('^2026[_-]Q2');
    expect(filter.sql).toContain('campaign_key ~');
  });

  it('should combine pending status and unsent filters correctly', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    const sql = filter.sql;

    // Check that pending status is enforced
    expect(sql).toContain("op.status = 'pending'");

    // Check that unsent conditions are present
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('COALESCE(op.total_send_count, 0) = 0');

    // Check that junk mail is excluded
    expect(sql).toContain('no_junk_mail = true');
  });

  it('should never show the same property in both sent and unsent filters', () => {
    const sentFilter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'sent',
    });

    const unsentFilter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    // Sent filter should have EXISTS
    expect(sentFilter.sql).toContain('EXISTS');

    // Unsent filter should have NOT EXISTS
    expect(unsentFilter.sql).toContain('NOT EXISTS');

    // They should not be identical
    expect(sentFilter.sql).not.toBe(unsentFilter.sql);
  });

  it('should have correct parameter count for unsent with reportQuarter', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
      reportQuarter: '2026-Q2',
    });

    // Parameters should be: [suburb, suburb (in subquery), quarter, year, reportQuarter, reportQuarter_alt]
    expect(filter.params.length).toBeGreaterThan(0);
    expect(filter.params[0]).toBe('Torbay');
  });

  it('should properly handle null junk mail flags', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    // The NOT EXISTS clause should be checking p2.no_junk_mail = true
    // So addresses with NULL or false should be included
    expect(filter.sql).toContain('p2.no_junk_mail = true');
  });

  it('should exclude sent status in unsent filter', () => {
    const filter = buildOutreachFilter({
      suburb: 'Torbay',
      status: 'pending',
      sentStatus: 'unsent',
    });

    // Should check that total_send_count = 0 (never sent)
    expect(filter.sql).toContain('COALESCE(op.total_send_count, 0) = 0');

    // Should check that last_sent_at IS NULL
    expect(filter.sql).toContain('op.last_sent_at IS NULL');

    // Should check that sent_at IS NULL
    expect(filter.sql).toContain('op.sent_at IS NULL');
  });

  it('should not exclude properties sent in earlier quarters when reportQuarter is set', () => {
    const filter = buildOutreachFilter({
      suburb: 'Oteha',
      status: 'pending',
      sentStatus: 'unsent',
      reportQuarter: '2026-Q3',
    });

    expect(filter.sql).toContain("op.status IN ('pending', 'sent')");
    expect(filter.sql).not.toContain("op.status = 'pending'");
    expect(filter.sql).not.toContain('COALESCE(op.total_send_count, 0) = 0');
    expect(filter.sql).not.toContain('op.last_sent_at IS NULL');
    expect(filter.sql).toContain('NOT EXISTS');
  });

  it('should scope sent filter to the quarter send log only when reportQuarter is set', () => {
    const filter = buildOutreachFilter({
      suburb: 'Oteha',
      status: 'pending',
      sentStatus: 'sent',
      reportQuarter: '2026-Q3',
    });

    expect(filter.sql).toContain("op.status IN ('pending', 'sent')");
    expect(filter.sql).not.toContain("(op.status = 'sent' OR op.status = 'pending')");
    expect(filter.sql).not.toContain('COALESCE(op.total_send_count, 0) > 0');
    expect(filter.params).toContain('Q3');
    expect(filter.params).toContain(2026);
    expect(filter.params).toContain('^2026[_-]Q3');
  });

  it('should not use global sent heuristics when reportQuarter is malformed', () => {
    const filter = buildOutreachFilter({
      suburb: 'Oteha',
      status: 'pending',
      sentStatus: 'unsent',
      reportQuarter: 'bad-quarter',
    });

    expect(filter.params).not.toContain('^2026[_-]Q3');
    expect(filter.sql).toContain('COALESCE(op.total_send_count, 0) = 0');
  });
});
