import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blockSpecs: [] as Array<{
    spec: { type: string; propSchema: Record<string, { default: string }> };
    implementation: {
      render: (block: { id: string; props: Record<string, string> }, editor: object) => { dom: HTMLElement };
    };
  }>,
}));

vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: vi.fn((schema) => schema) },
  createBlockSpec: vi.fn((spec, implementation) => {
    mocks.blockSpecs.push({ spec, implementation });
    return () => ({});
  }),
  defaultBlockSpecs: {},
}));

import { createMarketReportSchema } from '@/components/market/market-report-blocks';

describe('market report blocks', () => {
  beforeEach(() => {
    mocks.blockSpecs.length = 0;
  });

  it('marks the market pulse block so report typography styles leave its card colors intact', () => {
    createMarketReportSchema(false);

    const pulse = mocks.blockSpecs.find(({ spec }) => spec.type === 'marketPulse');
    expect(pulse).toBeTruthy();
    if (!pulse) return;

    const props = Object.fromEntries(
      Object.entries(pulse.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    const node = pulse.implementation.render({ id: 'pulse-1', props }, {});

    expect(node.dom.classList.contains('market-report-pulse')).toBe(true);
  });

  it('notifies autosave when an editable market pulse field changes', () => {
    const onEdit = vi.fn();
    createMarketReportSchema(true, new Map(), onEdit);

    const pulse = mocks.blockSpecs.find(({ spec }) => spec.type === 'marketPulse');
    expect(pulse).toBeTruthy();
    if (!pulse) return;

    const props = Object.fromEntries(
      Object.entries(pulse.spec.propSchema).map(([key, value]) => [key, value.default])
    );
    const node = pulse.implementation.render({ id: 'pulse-1', props }, {});
    const field = node.dom.querySelector('[data-prop]');
    expect(field).toBeTruthy();
    field?.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
