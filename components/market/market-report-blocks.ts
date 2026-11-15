import { BlockNoteSchema, createBlockSpec, defaultBlockSpecs } from '@blocknote/core';
import { buildMarketPulseHTML, statDirection, type MarketPulseProps } from '@/lib/market-pulse';

export type MarketPulseFlushRegistry = Map<string, () => void>;

function createMarketPulseBlock(editable: boolean, flushRegistry?: MarketPulseFlushRegistry) {
  return createBlockSpec(
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
      render: (block, editor) => {
        const blockId = block.id;
        const container = document.createElement('div');
        container.style.cssText = 'width:100%;min-width:0;box-sizing:border-box;font-family:inherit;';
        container.innerHTML = buildMarketPulseHTML(block.props as MarketPulseProps, editable);

        const updateArrow = (prop: string) => {
          const arrow = container.querySelector<HTMLElement>(`[data-arrow="${prop}"]`);
          if (!arrow) return;
          const direction = statDirection(container.querySelector<HTMLElement>(`[data-prop="${prop}"]`)?.textContent ?? '');
          arrow.textContent = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
          const valueColumn = arrow.parentElement;
          const invertColor = prop === 'compareDays';
          if (valueColumn) {
            valueColumn.style.color = direction === 'none'
              ? '#0f172a'
              : (direction === 'up') !== invertColor ? '#16a34a' : '#dc2626';
          }
        };

        const flush = () => {
          if (!editable) return;
          const changes: Record<string, string> = {};
          container.querySelectorAll<HTMLElement>('[data-prop]').forEach((element) => {
            const prop = element.dataset.prop;
            if (!prop) return;
            const value = (element.textContent ?? '').trim();
            if (value !== String(block.props[prop as keyof typeof block.props] ?? '')) changes[prop] = value;
          });
          if (!Object.keys(changes).length) return;
          const current = editor.getBlock(blockId);
          if (!current) return;
          editor.updateBlock(blockId, { props: { ...current.props, ...changes } });
        };

        if (editable) {
          flushRegistry?.set(blockId, flush);
          container.addEventListener('focusout', (event) => {
            const next = event.relatedTarget as Node | null;
            if (next && container.contains(next)) return;
            flush();
          });
          container.addEventListener('input', (event) => {
            const target = event.target as HTMLElement | null;
            const prop = target?.dataset.prop;
            if (prop === 'comparePrice' || prop === 'compareSales' || prop === 'compareDays') updateArrow(prop);
          });
        }

        return {
          dom: container,
          ignoreMutation: () => true,
          destroy: () => flushRegistry?.delete(blockId),
        };
      },
    },
  );
}

export function createMarketReportSchema(editable: boolean, flushRegistry?: MarketPulseFlushRegistry) {
  return BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      marketPulse: createMarketPulseBlock(editable, flushRegistry)(),
    },
  });
}
