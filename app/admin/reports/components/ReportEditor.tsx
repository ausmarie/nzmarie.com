'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, createInlineContentSpec, createBlockSpec } from '@blocknote/core';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useAutoSave } from '../hooks/useAutoSave';
import { useImageUpload } from '../hooks/useImageUpload';
import { useReportStore } from '../stores/report-store';
import { buildMarketPulseHTML, statDirection } from '@/lib/market-pulse';
import type { ReportEditorContent } from '@/types/report';

function createDeltaSVG(height: string, strokeColor: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.height = height;
  svg.style.width = 'auto';
  svg.style.display = 'block';
  svg.style.cursor = 'pointer';
  svg.style.flexShrink = '0';

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 3L22 18H2Z');
  path1.setAttribute('stroke', strokeColor);
  path1.setAttribute('stroke-width', '2.5');
  path1.setAttribute('stroke-linecap', 'round');
  path1.setAttribute('stroke-linejoin', 'round');

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M2 22H22');
  path2.setAttribute('stroke', strokeColor);
  path2.setAttribute('stroke-width', '2.5');
  path2.setAttribute('stroke-linecap', 'round');
  path2.setAttribute('stroke-linejoin', 'round');

  svg.append(path1, path2);
  return svg;
}

function createToolbar(
  currentHeight: string,
  onUpdateHeight: (h: string) => void,
): HTMLDivElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'print:hidden';
  toolbar.style.cssText = `
    position: absolute; top: -36px; left: 50%; transform: translateX(-50%);
    background: #1e293b; color: white; padding: 4px 8px; border-radius: 6px;
    display: flex; align-items: center; gap: 8px; font-size: 11px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 50; white-space: nowrap;
  `;

  const label = document.createElement('span');
  label.textContent = 'Height:';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentHeight;
  input.style.cssText = `
    width: 45px; background: #334155; border: none; border-radius: 3px;
    color: white; padding: 2px 4px; font-size: 11px; text-align: center; outline: none;
  `;
  input.addEventListener('input', () => onUpdateHeight(input.value));
  input.addEventListener('click', (e) => e.stopPropagation());

  const btnPlus = document.createElement('button');
  btnPlus.textContent = '+';
  btnPlus.style.cssText = `
    background: #334155; border: none; color: white; border-radius: 3px;
    padding: 2px 6px; cursor: pointer;
  `;
  btnPlus.addEventListener('click', (e) => {
    e.stopPropagation();
    const num = parseInt(currentHeight) || 36;
    onUpdateHeight(`${num + 4}px`);
  });

  const btnMinus = document.createElement('button');
  btnMinus.textContent = '-';
  btnMinus.style.cssText = `
    background: #334155; border: none; color: white; border-radius: 3px;
    padding: 2px 6.5px; cursor: pointer;
  `;
  btnMinus.addEventListener('click', (e) => {
    e.stopPropagation();
    const num = parseInt(currentHeight) || 36;
    onUpdateHeight(`${Math.max(12, num - 4)}px`);
  });

  toolbar.append(label, input, btnPlus, btnMinus);
  toolbar.addEventListener('click', (e) => e.stopPropagation());
  return toolbar;
}

const deltaInlineContent = createInlineContentSpec(
  {
    type: 'delta' as const,
    content: 'none',
    propSchema: {
      height: { default: '36px' },
      strokeColor: { default: '#1e40af' },
    },
  },
  {
    render: (inlineContent, updateInlineContent) => {
      let showToolbar = false;
      let currentHeight = inlineContent.props.height;
      const currentColor = inlineContent.props.strokeColor;

      const container = document.createElement('span');
      container.style.cssText = `
        display: inline-flex; align-items: center; position: relative;
        padding: 2px; border-radius: 6px; transition: border 0.2s;
        vertical-align: middle;
      `;

      const svg = createDeltaSVG(currentHeight, currentColor);

      let toolbar: HTMLDivElement | null = null;

      const closeToolbar = () => {
        showToolbar = false;
        if (toolbar) { toolbar.remove(); toolbar = null; }
        container.style.border = '1px solid transparent';
      };

      const openToolbar = () => {
        showToolbar = true;
        container.style.border = '1px dashed #e2e8f0';
        toolbar = createToolbar(currentHeight, (h) => {
          currentHeight = h;
          svg.style.height = h;
          updateInlineContent({ type: 'delta', props: { height: h, strokeColor: currentColor } });
        });
        container.append(toolbar);
      };

      svg.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (showToolbar) { closeToolbar(); } else { openToolbar(); }
      });

      container.append(svg);

      const onDocClick = (e: MouseEvent) => {
        if (showToolbar && container && !container.contains(e.target as Node)) {
          closeToolbar();
        }
      };
      document.addEventListener('mousedown', onDocClick);

      return {
        dom: container,
        destroy: () => {
          document.removeEventListener('mousedown', onDocClick);
        },
      };
    },
  },
);

const quarterlyDataBlock = createBlockSpec(
  {
    type: 'quarterlyData' as const,
    content: 'none',
    propSchema: {
      suburbName: { default: '' },
      totalVolume: { default: '' },
      totalSales: { default: '' },
      avgDaysToSell: { default: '' },
      periodText: { default: '' },
      compareLabel: { default: '' },
      comparePriceChange: { default: '' },
      comparePriceUp: { default: 'false' },
      compareSalesChange: { default: '' },
      compareSalesUp: { default: 'false' },
      compareDaysChange: { default: '' },
      compareDaysUp: { default: 'false' },
      insightText: { default: '' },
    },
  },
  {
    render: (block: any) => {
      const p = block.props;
      const priceUp = p.comparePriceUp === 'true';
      const salesUp = p.compareSalesUp === 'true';
      const daysUp = p.compareDaysUp === 'true';

      // prefer numeric fields when present to avoid picking up stale formatted monthly values
      const fmtM = (v: number | null | undefined) => (v == null ? '\u2014' : `$${(v / 1000000).toFixed(1)}M`);
      const displayTotalVolume = (p.totalVolumeNumeric != null) ? fmtM(Number(p.totalVolumeNumeric)) : (p.totalVolume || '\u2014');
      const displayTotalSales = (p.totalSalesNumeric != null) ? String(p.totalSalesNumeric) : (p.totalSales || '\u2014');

      const kpiCard = (label: string, value: string, color?: string) => `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;flex:1;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06);">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:.05em;display:block;margin-bottom:8px;text-transform:none;">${label}</span>
          <span style="font-size:26px;font-weight:800;color:${color || '#0f172a'};display:block;">${value}</span>
        </div>
      `;

      const statCol = (label: string, value: string, up: boolean, invertColor = false) => {
        const arrow = up ? '\u25B2' : '\u25BC';
        const green = invertColor ? !up : up;
        const col = green ? '#16a34a' : '#dc2626';
        return `
          <div style="text-align:center;flex:1;">
            <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:4px;">${label}</div>
            <div style="font-size:14px;font-weight:700;color:${col};">${arrow} ${value}</div>
          </div>
        `;
      };

      const html = `
        <div style="font-family:inherit;">
          <div style="display:flex;gap:12px;margin-bottom:16px;">
            ${kpiCard('Total Volume', displayTotalVolume)}
            ${kpiCard('Transactions', displayTotalSales, '#2563eb')}
            ${kpiCard('Avg Days to Sell', p.avgDaysToSell ? p.avgDaysToSell + ' Days' : '\u2014')}
          </div>
          ${p.avgDaysToSell ? `
          <div style="background:rgba(226,242,254,0.7);border:1px solid #cbd5e1;border-radius:12px;padding:20px 24px;">
            <div style="margin-bottom:12px;">
              <span style="font-size:28px;font-weight:800;color:#1e3a8a;">${p.avgDaysToSell} Days to Sell</span>
            </div>
            ${p.insightText ? `<p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 16px;">${p.insightText}</p>` : ''}
            ${p.compareLabel ? `
            <div style="border-top:1px solid #cbd5e1;padding-top:14px;margin-top:4px;">
              <div style="font-size:11px;font-weight:700;color:#1e40af;margin-bottom:10px;">${p.compareLabel}</div>
              <div style="display:flex;gap:8px;">
                ${statCol('Median Price', p.comparePriceChange || '\u2014', priceUp)}
                ${statCol('Sales Count', p.compareSalesChange || '\u2014', salesUp)}
                ${statCol('Days to Sell', p.compareDaysChange || '\u2014', daysUp, true)}
              </div>
            </div>` : ''}
          </div>` : ''}
        </div>
      `;

      const container = document.createElement('div');
      container.innerHTML = html;
      return { dom: container };
    },

  }
);

const marketPulseEdits = new Map<string, { flush: () => void; token: object }>();

function flushMarketPulseEdits(): void {
  for (const entry of Array.from(marketPulseEdits.values())) {
    entry.flush();
  }
}

const marketPulseBlock = createBlockSpec(
  {
    type: 'marketPulse' as const,
    content: 'none',
    propSchema: {
      medianPrice: { default: '' },
      salesCount: { default: '' },
      daysToSell: { default: '' },
      medianLabel: { default: '' },
      salesLabel: { default: '' },
      daysLabel: { default: '' },
      card2Note: { default: '' },
      districtLine: { default: '' },
      priceNote: { default: '' },
      compareLabel: { default: '' },
      comparePrice: { default: '' },
      compareSales: { default: '' },
      compareDays: { default: '' },
      statPriceLabel: { default: '' },
      statSalesLabel: { default: '' },
      statDaysLabel: { default: '' },
    },
  },
  {
    render: (block: any, editor: any) => {
      const p = block.props;
      const blockId = block.id as string;
      const container = document.createElement('div');
      container.style.cssText =
        'font-family:inherit;flex-grow:1;flex-shrink:1;flex-basis:0;width:100%;min-width:0;box-sizing:border-box;';
      container.innerHTML = buildMarketPulseHTML(p);

      const focusOrigins = new Map<string, string>();

      const readValue = (prop: string): string => {
        const el = container.querySelector<HTMLElement>(`[data-prop="${prop}"]`);
        return (el?.textContent ?? '').trim();
      };

      const updateArrow = (prop: string) => {
        const arrowEl = container.querySelector<HTMLElement>(`[data-arrow="${prop}"]`);
        if (!arrowEl) return;
        const dir = statDirection(readValue(prop));
        arrowEl.textContent = dir === 'up' ? '\u25B2' : dir === 'down' ? '\u25BC' : '';
        const valueCol = arrowEl.parentElement;
        if (valueCol) {
          const invert = prop === 'compareDays';
          const upColor = invert ? '#dc2626' : '#16a34a';
          const downColor = invert ? '#16a34a' : '#dc2626';
          valueCol.style.color = dir === 'up' ? upColor : dir === 'down' ? downColor : '#0f172a';
        }
      };

      const flush = () => {
        const changes: Record<string, string> = {};
        container.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
          const prop = el.dataset.prop;
          if (!prop) return;
          const value = (el.textContent ?? '').trim();
          if (value !== String(p[prop] ?? '')) changes[prop] = value;
        });
        if (Object.keys(changes).length === 0) return;
        if (!editor || typeof editor.updateBlock !== 'function') return;
        const current = typeof editor.getBlock === 'function' ? editor.getBlock(blockId) : null;
        const base = (current?.props ?? p) as Record<string, unknown>;
        editor.updateBlock(blockId, { props: { ...base, ...changes } });
      };

      const token = {};
      marketPulseEdits.set(blockId, { flush, token });

      container.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
        const prop = el.dataset.prop as string;

        el.addEventListener('mousedown', (e) => e.stopPropagation());
        el.addEventListener('click', (e) => e.stopPropagation());
        el.addEventListener('beforeinput', (e) => e.stopPropagation());
        el.addEventListener('drop', (e) => e.preventDefault());
        el.addEventListener('paste', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = e.clipboardData?.getData('text/plain') ?? '';
          if (text) document.execCommand('insertText', false, text);
        });
        el.addEventListener('focus', () => {
          focusOrigins.set(prop, el.textContent ?? '');
          el.style.boxShadow = '0 0 0 1px #93c5fd';
        });
        el.addEventListener('input', () => updateArrow(prop));
        el.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.isComposing) return;
          const isSave = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's';
          if (isSave) return;
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
            return;
          }
          if (e.key === 'Escape') {
            el.textContent = focusOrigins.get(prop) ?? String(p[prop] ?? '');
            updateArrow(prop);
            el.blur();
          }
        });
        el.addEventListener('blur', () => {
          el.style.boxShadow = '';
        });
      });

      container.addEventListener('focusout', (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null;
        if (next && container.contains(next)) return;
        flush();
      });

      return {
        dom: container,
        ignoreMutation: () => true,
        destroy: () => {
          const existing = marketPulseEdits.get(blockId);
          if (existing && existing.token === token) marketPulseEdits.delete(blockId);
        },
      };
    },
  }
);

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, quarterlyData: quarterlyDataBlock(), marketPulse: marketPulseBlock() } as any,
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    delta: deltaInlineContent,
  },
});


const insertDeltaItem = (editor: any) => ({
  title: 'Delta Icon',
  onItemClick: () => {
    editor.insertInlineContent([
      { type: 'delta', props: { height: '36px', strokeColor: '#1e40af' } },
      ' ',
    ]);
  },
  aliases: ['delta', 'icon', 'brand', 'logo'],
  group: 'Custom Blocks',
  subtext: 'Insert a premium custom SVG brand mark.',
});

interface ReportEditorProps {
  docId: string;
  initialContent: ReportEditorContent | null;
  onContentChange?: (content: ReportEditorContent) => void;
  className?: string;
  getContentRef?: React.MutableRefObject<(() => ReportEditorContent | null) | null>;
}

function normalizeBlock(block: any): any {
  if (!block || typeof block !== 'object') return block;

  const id = block.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36));
  const type = block.type || 'paragraph';
  const props = block.props || {};
  const children = Array.isArray(block.children) ? block.children.map(normalizeBlock) : [];

  let content = block.content;
  if (Array.isArray(content)) {
    content = content.map((item: any) => {
      if (typeof item === 'string') {
        return { type: 'text', text: item, styles: {} };
      }
      if (item && typeof item === 'object') {
        if (!item.type) item.type = 'text';
        if (item.type === 'text') {
          if (!item.styles) item.styles = {};
          if (item.text === undefined) item.text = '';
        }
      }
      return item;
    });
  } else if (typeof content === 'string') {
    content = [{ type: 'text', text: content, styles: {} }];
  } else if (!content) {
    content = [];
  }

  return {
    ...block,
    id,
    type,
    props,
    content,
    children,
  };
}

function migrateContent(content: ReportEditorContent | null): ReportEditorContent | null {
  if (!content) return content;
  if (Array.isArray(content)) {
    return content.map(normalizeBlock) as ReportEditorContent;
  }
  return content;
}

export default function ReportEditor({ docId, initialContent, onContentChange, className, getContentRef }: ReportEditorProps) {
  const { isSaving, lastSaved, setIsSaving, setLastSaved, updateDocument } = useReportStore();
  const { handleImageFile } = useImageUpload();

  const migrated = migrateContent(initialContent);

  const editor = useCreateBlockNote({
    schema,
    initialContent: migrated ?? undefined,
    trailingBlock: false,
    uploadFile: async (file: File) => {
      return handleImageFile(file, docId);
    },
  });

  // Sanitize editor.document to remove functions and DOM nodes and convert circular refs to null so structure remains
  const sanitize = useCallback((value: unknown, _seen = new WeakSet()): unknown => {
    const seen = _seen as WeakSet<object>;
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value as object)) {
      // preserve placeholder for circular refs rather than removing array items/keys entirely
      return null;
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      // keep null placeholders so array positions are preserved
      const out = (value as unknown[]).map((v) => sanitize(v, seen));
      return out;
    }

    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // skip functions
      if (typeof v === 'function') continue;
      // skip DOM nodes (have nodeType number)
      if (v && typeof v === 'object' && 'nodeType' in (v as any) && typeof (v as any).nodeType === 'number') continue;
      const sv = sanitize(v, seen);
      // include nulls (from circular refs) explicitly
      if (sv !== undefined) obj[k] = sv;
    }
    return obj;
  }, []);

  const lastSaveRef = useRef<Promise<any> | null>(null);

  const doFetchSave = useCallback(async (docId: string, safeBlocks: ReportEditorContent | null) => {
    const body = JSON.stringify({ id: docId, content: safeBlocks });
    console.log('[Save] PUT start — docId:', docId, 'blocks:', safeBlocks?.length);

    let res;
    try {
      res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch {
      console.log('[Save] PUT network error — docId:', docId);
      return new Response(null, { status: 0 });
    }
    console.log('[Save] PUT response — docId:', docId, 'status:', res.status);
    if (!res.ok) {
      return res;
    }
    const result = await res.json();
    if (result.success) {
      console.log('[Save] PUT success — docId:', docId);
      setLastSaved(new Date().toLocaleTimeString('en-NZ'));
      updateDocument(docId, { content: safeBlocks as ReportEditorContent });
      onContentChange?.(safeBlocks as ReportEditorContent);
    }
    return res;
  }, [setLastSaved, updateDocument, onContentChange]);

  const saveContent = useCallback(async () => {
    flushMarketPulseEdits();
    const blocks = editor.document;
    const safeBlocks = sanitize(blocks) as ReportEditorContent | null;

    // If a save is already in-flight, wait for it to finish to avoid racing writes.
    if (lastSaveRef.current) {
      try {
        await lastSaveRef.current;
      } catch {
        // ignore previous save error and continue with a fresh save
      }
    }

    setIsSaving(true);

    const savePromise = (async () => {
      try {
        await doFetchSave(docId, safeBlocks);
      } catch (err) {
        console.error('Failed to save report document', err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    })();

    lastSaveRef.current = savePromise;
    try {
      await savePromise;
    } finally {
      // clear only if this is the same promise
      if (lastSaveRef.current === savePromise) lastSaveRef.current = null;
    }
  }, [editor, docId, setIsSaving, doFetchSave, sanitize]);

  useEffect(() => {
    if (getContentRef) {
      getContentRef.current = () => {
        flushMarketPulseEdits();
        return sanitize(editor.document) as ReportEditorContent | null;
      };
    }
    return () => {
      if (getContentRef) {
        getContentRef.current = null;
      }
    };
  }, [editor, getContentRef, sanitize]);

  useAutoSave({
    data: editor.document,
    onSave: saveContent,
    delay: 6000,
    enabled: true,
  });

  const handleChange = useCallback(() => {
    const now = Date.now();
    if (now - (editor as { _lastChangeTime?: number })._lastChangeTime! > 500) {
      (editor as { _lastChangeTime?: number })._lastChangeTime = now;
    }
  }, [editor]);

  return (
    <div className={'report-editor-container' + (className ? ' ' + className : '')} style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
      <div className="reports-editor-status" style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', fontSize: '0.8rem', color: '#999',
        background: 'white', borderBottom: '1px solid #eee',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isSaving ? '#f59e0b' : '#22c55e',
          }} />
          {isSaving ? 'Saving...' : lastSaved ? `Saved at ${lastSaved}` : 'Ready'}
        </span>
      </div>
      <div style={{ background: 'white' }}>
        <BlockNoteView editor={editor} theme="light" onChange={handleChange} slashMenu={false}>
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  insertDeltaItem(editor),
                ],
                query
              )
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}
