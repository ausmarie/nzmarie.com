export function formatReportKey(campaign: string = '', suburb: string = ''): string {
  const c = (campaign || '').trim();
  const s = (suburb || '').trim();

  const m1 = c.match(/^(\d{4})[_-](Q[1-4])[_-](.+)$/i);
  if (m1) {
    const [, year, quarter, subPart] = m1;
    const effectiveSub = subPart.toLowerCase() === 'report' && s ? s : subPart;
    const cleanSub = effectiveSub.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${quarter.toUpperCase()}-${year}`;
  }

  const m1Month = c.match(/^(\d{4})[_-](M?(?:0[1-9]|1[0-2]))[_-](.+)$/i);
  if (m1Month) {
    const [, year, month, subPart] = m1Month;
    const code = month.length === 2 ? `M${month}` : month;
    const effectiveSub = subPart.toLowerCase() === 'report' && s ? s : subPart;
    const cleanSub = effectiveSub.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${code.toUpperCase()}-${year}`;
  }

  const m2 = c.match(/^(\d{4})[_-](Q[1-4])(?:[_-]Report)?$/i);
  if (m2 && s) {
    const [, year, quarter] = m2;
    const cleanSub = s.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${quarter.toUpperCase()}-${year}`;
  }

  const m2Month = c.match(/^(\d{4})[_-](M?(?:0[1-9]|1[0-2]))(?:[_-]Report)?$/i);
  if (m2Month && s) {
    const [, year, month] = m2Month;
    const code = month.length === 2 ? `M${month}` : month;
    const cleanSub = s.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${code.toUpperCase()}-${year}`;
  }

  const m3 = c.match(/^(.+?)[_-](Q[1-4])[_-](\d{4})$/i);
  if (m3) {
    const [, subPart, quarter, year] = m3;
    const effectiveSub = subPart.toLowerCase() === 'report' && s ? s : subPart;
    const cleanSub = effectiveSub.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${quarter.toUpperCase()}-${year}`;
  }

  const m3Month = c.match(/^(.+?)[_-](M?(?:0[1-9]|1[0-2]))[_-](\d{4})$/i);
  if (m3Month) {
    const [, subPart, month, year] = m3Month;
    const code = month.length === 2 ? `M${month}` : month;
    const effectiveSub = subPart.toLowerCase() === 'report' && s ? s : subPart;
    const cleanSub = effectiveSub.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${cleanSub}-${code.toUpperCase()}-${year}`;
  }

  if (s) {
    const cleanSub = s.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    if (/q3/i.test(c)) {
      return `${cleanSub}-Q3-2026`;
    }
    if (/q1/i.test(c)) {
      return `${cleanSub}-Q1-2026`;
    }
    if (/q4/i.test(c)) {
      return `${cleanSub}-Q4-2026`;
    }
    return `${cleanSub}-Q2-2026`;
  }

  return c || 'Unknown Report';
}
