export type LeadPriority = 'high' | 'medium' | 'low';

export type PrioritySource = 'auto' | 'manual';

export const DEFAULT_PRIORITY: LeadPriority = 'medium';

export const TIMELINE_PRIORITY: Record<string, LeadPriority> = {
  'within-3-months': 'high',
  '3-6-months': 'medium',
  '6-12-months': 'low',
  'just-exploring': 'low',
};

export const TIMELINE_LABELS: Record<string, string> = {
  'within-3-months': 'Within 3 months',
  '3-6-months': '3–6 months',
  '6-12-months': '6–12 months',
  'just-exploring': 'Just exploring',
};

export function isKnownTimeline(timeline: string | null | undefined): boolean {
  return Boolean(timeline && timeline in TIMELINE_PRIORITY);
}

/**
 * Priority is derived from the appraisal timeline, not from the database
 * default. Unknown or missing timelines fall back to "medium".
 */
export function priorityFromTimeline(timeline: string | null | undefined): LeadPriority {
  if (!timeline) return DEFAULT_PRIORITY;
  return TIMELINE_PRIORITY[timeline] ?? DEFAULT_PRIORITY;
}

export function timelineLabel(timeline: string | null | undefined): string {
  if (!timeline) return 'Not provided';
  return TIMELINE_LABELS[timeline] ?? timeline;
}

/**
 * Resolve the priority that should be shown/used for an appraisal. A manual
 * override always wins; otherwise the value is derived from the timeline.
 */
export function resolvePriority(
  timeline: string | null | undefined,
  storedPriority: string | null | undefined,
  source: string | null | undefined
): LeadPriority {
  if (source === 'manual') {
    return storedPriority === 'high' || storedPriority === 'low' || storedPriority === 'medium'
      ? storedPriority
      : DEFAULT_PRIORITY;
  }
  if (isKnownTimeline(timeline)) {
    return priorityFromTimeline(timeline);
  }
  return storedPriority === 'high' || storedPriority === 'low' || storedPriority === 'medium'
    ? storedPriority
    : DEFAULT_PRIORITY;
}
