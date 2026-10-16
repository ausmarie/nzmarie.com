'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface PanelStreet {
  street: string;
  suburb: string;
  address_count: number;
  has_coords: boolean;
}

interface ManualRunPanelProps {
  isOpen: boolean;
  onClose: () => void;
  suburb: string;
  reportQuarter?: string;
  onOrderApplied: (streets: string[]) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SortableRowProps {
  item: PanelStreet;
  isNew: boolean;
  onMove: (street: string, dir: -1 | 1) => void;
}

function SortableRow({ item, isNew, onMove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.street,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: '#ffffff',
      }}
    >
      <span
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          color: '#a78bfa',
          fontSize: '1rem',
          userSelect: 'none',
          touchAction: 'none',
          display: 'inline-flex',
          flexShrink: 0,
        }}
        title="Drag to reorder"
      >
        ⠿
      </span>
      <span
        style={{
          flex: 1,
          fontSize: '0.85rem',
          fontWeight: '500',
          color: '#374151',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.street}
        {isNew && (
          <span
            style={{
              marginLeft: '6px',
              fontSize: '0.66rem',
              color: '#d97706',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '999px',
              padding: '1px 6px',
              verticalAlign: 'middle',
              whiteSpace: 'nowrap',
            }}
          >
            new
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: '0.72rem',
          color: '#6b7280',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {item.address_count} addr
      </span>
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onMove(item.street, -1)}
          aria-label={`Move ${item.street} up`}
          style={{
            width: '24px',
            height: '24px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.8rem',
            lineHeight: 1,
          }}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(item.street, 1)}
          aria-label={`Move ${item.street} down`}
          style={{
            width: '24px',
            height: '24px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.8rem',
            lineHeight: 1,
          }}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

export default function ManualRunPanel({
  isOpen,
  onClose,
  suburb,
  reportQuarter,
  onOrderApplied,
}: ManualRunPanelProps) {
  const [items, setItems] = useState<PanelStreet[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [hasSavedOrder, setHasSavedOrder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(() => {
    if (!isOpen || !suburb) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ suburb });
    if (reportQuarter) params.set('report_quarter', reportQuarter);
    fetch(`/api/admin/outreach/street-order?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load streets');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setItems(json.streets || []);
        setSavedOrder(json.savedOrder || []);
        setHasSavedOrder(!!json.hasSavedOrder);
        setSaveState('idle');
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load streets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, suburb, reportQuarter]);

  useEffect(() => {
    const cleanup = load();
    return () => {
      cleanup?.();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [load]);

  const savedOrderSet = useMemo(() => new Set(savedOrder), [savedOrder]);

  const persistOrder = useCallback(
    async (nextOrder: string[]) => {
      setSaveState('saving');
      try {
        const res = await fetch('/api/admin/outreach/street-order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suburb, streets: nextOrder }),
        });
        if (!res.ok) throw new Error('Save failed');
        setSavedOrder(nextOrder);
        setHasSavedOrder(nextOrder.length > 0);
        setSaveState('saved');
        onOrderApplied(nextOrder);
      } catch {
        setSaveState('error');
      }
    },
    [suburb, onOrderApplied]
  );

  const scheduleSave = useCallback(
    (nextOrder: string[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        persistOrder(nextOrder);
      }, 600);
    },
    [persistOrder]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.street === active.id);
    const newIndex = items.findIndex((i) => i.street === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    scheduleSave(next.map((i) => i.street));
  };

  const move = (street: string, dir: -1 | 1) => {
    const index = items.findIndex((i) => i.street === street);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = arrayMove(items, index, target);
    setItems(next);
    scheduleSave(next.map((i) => i.street));
  };

  const handleReset = async () => {
    if (!suburb) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await fetch(`/api/admin/outreach/street-order?suburb=${encodeURIComponent(suburb)}`, {
        method: 'DELETE',
      });
    } catch {
      // non-fatal; order will be refetched below
    }
    setSaveState('idle');
    onOrderApplied([]);
    load();
  };

  if (!isOpen) return null;

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? 'Save failed' : '';

  return (
    <div
      style={{
        marginTop: '10px',
        borderRadius: '10px',
        border: '1px solid #e9d5ff',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '10px 14px',
          backgroundColor: '#f5f3ff',
          borderBottom: '1px solid #ede9fe',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#7c3aed' }}>
          ⚙️ Manual Run — {suburb}
          {!loading && items.length > 0 && (
            <span style={{ fontWeight: '400', color: '#6b7280', marginLeft: '6px' }}>
              · {items.length} {items.length === 1 ? 'street' : 'streets'}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saveLabel && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '600',
                color: saveState === 'error' ? '#dc2626' : saveState === 'saving' ? '#7c3aed' : '#16a34a',
              }}
            >
              {saveLabel}
            </span>
          )}
          {hasSavedOrder && (
            <button
              type="button"
              onClick={handleReset}
              style={{
                fontSize: '0.72rem',
                fontWeight: '600',
                color: '#7c3aed',
                backgroundColor: '#ffffff',
                border: '1px solid #d8b4fe',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              ↺ Reset to Auto
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: '0.72rem',
              fontWeight: '600',
              color: '#6b7280',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '14px', fontSize: '0.8rem', color: '#7c3aed' }}>Loading…</div>
      )}
      {error && <div style={{ padding: '14px', fontSize: '0.8rem', color: '#dc2626' }}>{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div style={{ padding: '14px', fontSize: '0.8rem', color: '#6b7280' }}>
          No unsent streets in this suburb.
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.street)} strategy={verticalListSortingStrategy}>
                {items.map((item) => (
                  <SortableRow
                    key={item.street}
                    item={item}
                    isNew={hasSavedOrder && !savedOrderSet.has(item.street)}
                    onMove={move}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div style={{ padding: '8px 14px', fontSize: '0.7rem', color: '#94a3b8' }}>
            Drag rows to reorder, or use the arrow buttons. Changes are saved automatically.
          </div>
        </>
      )}
    </div>
  );
}
