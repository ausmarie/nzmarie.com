export const CARD_PAGE_SIZE = 9;
export const LIST_PAGE_SIZE = 18;
export const UNSENT_STREET_LIST_PAGE_SIZE = 500;

export type OutreachViewMode = 'card' | 'list' | 'map';

export function getOutreachPageSize(
  viewMode: OutreachViewMode,
  isUnsentStreet: boolean,
): number {
  if (viewMode === 'list' && isUnsentStreet) {
    return UNSENT_STREET_LIST_PAGE_SIZE;
  }

  return viewMode === 'list' ? LIST_PAGE_SIZE : CARD_PAGE_SIZE;
}
