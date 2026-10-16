import { DateTime } from 'luxon';

const NZ_ZONE = 'Pacific/Auckland';

export function toNZTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return DateTime.fromJSDate(d).setZone(NZ_ZONE).toFormat('yyyy-MM-dd HH:mm:ss');
}

export function formatNZDate(date: Date | string | number, formatStr: string = 'yyyy-MM-dd HH:mm:ss ZZZZ'): string {
  const d = date instanceof Date ? date : new Date(date);
  return DateTime.fromJSDate(d).setZone(NZ_ZONE).toFormat(formatStr);
}

export function getNZNow(): DateTime {
  return DateTime.now().setZone(NZ_ZONE);
}
