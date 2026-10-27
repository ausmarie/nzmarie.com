import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRIORITY,
  isKnownTimeline,
  priorityFromTimeline,
  resolvePriority,
  timelineLabel,
} from '@/lib/priority';

describe('priority mapping', () => {
  it('derives priority from every known timeline', () => {
    expect(priorityFromTimeline('within-3-months')).toBe('high');
    expect(priorityFromTimeline('3-6-months')).toBe('medium');
    expect(priorityFromTimeline('6-12-months')).toBe('low');
    expect(priorityFromTimeline('just-exploring')).toBe('low');
  });

  it('falls back to medium for missing or unknown timelines', () => {
    expect(priorityFromTimeline(null)).toBe(DEFAULT_PRIORITY);
    expect(priorityFromTimeline(undefined)).toBe(DEFAULT_PRIORITY);
    expect(priorityFromTimeline('someday')).toBe(DEFAULT_PRIORITY);
    expect(isKnownTimeline('someday')).toBe(false);
    expect(isKnownTimeline('just-exploring')).toBe(true);
  });

  it('labels timelines for summaries and UI', () => {
    expect(timelineLabel('within-3-months')).toBe('Within 3 months');
    expect(timelineLabel('3-6-months')).toBe('3–6 months');
    expect(timelineLabel('6-12-months')).toBe('6–12 months');
    expect(timelineLabel('just-exploring')).toBe('Just exploring');
    expect(timelineLabel(null)).toBe('Not provided');
    expect(timelineLabel('custom')).toBe('custom');
  });
});

describe('resolvePriority', () => {
  it('uses the timeline for auto priorities', () => {
    expect(resolvePriority('just-exploring', 'medium', 'auto')).toBe('low');
    expect(resolvePriority('within-3-months', 'medium', 'auto')).toBe('high');
  });

  it('keeps a manual override', () => {
    expect(resolvePriority('just-exploring', 'high', 'manual')).toBe('high');
    expect(resolvePriority('within-3-months', 'low', 'manual')).toBe('low');
  });

  it('keeps the stored value when the timeline is unknown', () => {
    expect(resolvePriority(null, 'high', 'auto')).toBe('high');
    expect(resolvePriority('someday', 'low', 'auto')).toBe('low');
  });

  it('falls back to medium for invalid manual values', () => {
    expect(resolvePriority('just-exploring', 'urgent', 'manual')).toBe('medium');
  });
});
