/* eslint-disable @typescript-eslint/no-explicit-any */

import { monthName } from '@/lib/market-pulse';

function getContentText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
      .join('')
      .trim();
  }
  return '';
}

function textContainsDaysToSell(text: string): boolean {
  return /days?\s*to\s*sell/i.test(text);
}

function rawContainsDaysToSell(block: any): boolean {
  if (!block) return false;
  const text = getContentText(block.content);
  if (textContainsDaysToSell(text)) return true;
  if (block.props && typeof block.props === 'object') {
    for (const val of Object.values(block.props)) {
      if (typeof val === 'string' && textContainsDaysToSell(val)) return true;
    }
  }
  return false;
}

export function extractDaysToSellDescription(blocks: unknown[] | null): string | null {
  if (!Array.isArray(blocks)) return null;

  let foundHeader = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as any;
    const blockText = getContentText(block.content);
    if (!blockText) continue;

    if (foundHeader && block.type === 'paragraph') {
      return blockText;
    }

    if (block.type === 'heading' && textContainsDaysToSell(blockText)) {
      foundHeader = true;
      continue;
    }

    if (block.type === 'paragraph' && textContainsDaysToSell(blockText)) {
      if (/^the\s+average\s+days?\s*to\s*sell/i.test(blockText)) {
        return blockText;
      }
      foundHeader = true;
      continue;
    }
  }

  return null;
}

const FEATURING_DATE_RE = /Featuring\s+Latest\s+[A-Za-z]+\s+\d{4}\s+Data/;

function featuringReplacement(year: number, month: number): string {
  return `Featuring Latest ${monthName(month)} ${year} Data`;
}

function rewriteFeaturingDate(text: string, year: number, month: number): string {
  return text.replace(FEATURING_DATE_RE, featuringReplacement(year, month));
}

function rewriteFeaturingAcrossRuns(content: any[], year: number, month: number): any[] | null {
  const texts: string[] = [];
  for (const item of content) {
    if (typeof item === 'string') {
      texts.push(item);
    } else if (item && typeof item === 'object' && typeof item.text === 'string') {
      texts.push(item.text);
    } else {
      return null;
    }
  }

  const joined = texts.join('');
  const match = joined.match(FEATURING_DATE_RE);
  if (!match || match.index == null) return null;
  const start = match.index;
  const end = start + match[0].length;

  let acc = 0;
  let startIdx = -1;
  let endIdx = -1;
  let startOff = 0;
  let endOff = 0;
  for (let i = 0; i < texts.length; i++) {
    const s = acc;
    const e = acc + texts[i].length;
    if (startIdx === -1 && start >= s && start < e) {
      startIdx = i;
      startOff = start - s;
    }
    if (end > s && end <= e) {
      endIdx = i;
      endOff = end - s;
      break;
    }
    acc = e;
  }
  if (startIdx === -1 || endIdx === -1) return null;

  const startItem = content[startIdx];
  const runStyles =
    startItem && typeof startItem === 'object' && startItem.styles ? startItem.styles : {};

  const out: any[] = [];
  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    if (i < startIdx || i > endIdx) {
      out.push(item);
      continue;
    }
    if (i === startIdx) {
      const prefix = texts[i].slice(0, startOff);
      if (prefix) out.push(typeof item === 'string' ? prefix : { ...item, text: prefix });
      out.push({ type: 'text', text: featuringReplacement(year, month), styles: runStyles });
    }
    if (i === endIdx) {
      const suffix = texts[i].slice(endOff);
      if (suffix) out.push(typeof item === 'string' ? suffix : { ...item, text: suffix });
    }
  }
  return out;
}

export function updateIntroMonthYear(blocks: unknown[] | null, year: number, month: number): unknown[] | null {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block: any) => {
    if (!block || typeof block !== 'object') return block;

    if (typeof block.content === 'string') {
      const next = rewriteFeaturingDate(block.content, year, month);
      return next === block.content ? block : { ...block, content: next };
    }

    if (Array.isArray(block.content)) {
      let changed = false;
      const content = block.content.map((item: any) => {
        if (typeof item === 'string') {
          const next = rewriteFeaturingDate(item, year, month);
          if (next !== item) {
            changed = true;
            return next;
          }
          return item;
        }
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          const next = rewriteFeaturingDate(item.text, year, month);
          if (next !== item.text) {
            changed = true;
            return { ...item, text: next };
          }
          return item;
        }
        return item;
      });
      if (changed) {
        return { ...block, content };
      }
      const across = rewriteFeaturingAcrossRuns(block.content, year, month);
      if (across) {
        return { ...block, content: across };
      }
      return block;
    }

    return block;
  });
}

export function filterOutDaysToSellFromIntro(blocks: unknown[] | null): unknown[] | null {
  if (!Array.isArray(blocks)) return blocks;

  const out: unknown[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as any;

    if (rawContainsDaysToSell(block)) {
      continue;
    }

    out.push(block);
  }

  return out;
}
