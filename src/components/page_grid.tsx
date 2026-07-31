import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { color, font, primaryAlpha } from 'meoweo-shared';

import { PageThumbnail, THUMB_WIDTH } from './page_thumbnail';
import type { FileKind } from '../lib/file_type';
import type { Deck } from '../lib/page_deck';

type Props = {
  deck: Deck;
  bytes: ReadonlyMap<string, { kind: FileKind; bytes: Uint8Array }>;
  selected: ReadonlySet<string>;
  onToggleSelected: (id: string) => void;
  onMove: (from: number, to: number) => void;
};

type DragState = { fromIndex: number; overIndex: number } | null;

/** Which card index a point falls on, from the card elements themselves. */
function indexAtPoint(container: HTMLElement, x: number, y: number): number | null {
  const cards = container.querySelectorAll<HTMLElement>('[data-page-index]');
  for (const card of cards) {
    const box = card.getBoundingClientRect();
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      const raw = card.dataset['pageIndex'];
      return raw === undefined ? null : Number(raw);
    }
  }
  return null;
}

/**
 * The deck, as a grid of draggable cards.
 *
 * The pointer is captured on the **container**, never on a card. A card is keyed by page id and
 * re-renders as the order changes; capturing on one would hand the gesture to an element that is
 * about to be replaced, and the drag would die on the first move.
 */
export function PageGrid({
  deck,
  bytes,
  selected,
  onToggleSelected,
  onMove,
}: Props): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const movedRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent): void {
    const container = containerRef.current;
    if (container === null || e.button !== 0) {
      return;
    }
    const index = indexAtPoint(container, e.clientX, e.clientY);
    if (index === null) {
      return;
    }
    // Without this the browser may start a native selection drag and steal the pointer.
    e.preventDefault();
    container.setPointerCapture(e.pointerId);
    movedRef.current = false;
    setDrag({ fromIndex: index, overIndex: index });
  }

  function handlePointerMove(e: React.PointerEvent): void {
    const container = containerRef.current;
    if (container === null || drag === null) {
      return;
    }
    const index = indexAtPoint(container, e.clientX, e.clientY);
    if (index !== null && index !== drag.overIndex) {
      movedRef.current = true;
      setDrag({ ...drag, overIndex: index });
    }
  }

  function endDrag(e: React.PointerEvent): void {
    const container = containerRef.current;
    if (container === null || drag === null) {
      return;
    }
    if (container.hasPointerCapture(e.pointerId)) {
      container.releasePointerCapture(e.pointerId);
    }
    if (movedRef.current && drag.fromIndex !== drag.overIndex) {
      onMove(drag.fromIndex, drag.overIndex);
    } else {
      // A press that never moved is a click: select the card.
      const page = deck.pages[drag.fromIndex];
      if (page !== undefined) {
        onToggleSelected(page.id);
      }
    }
    setDrag(null);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      // An interrupted touch must not leave a card stuck to the finger.
      onPointerCancel={endDrag}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${String(THUMB_WIDTH)}px, 1fr))`,
        gap: 14,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {deck.pages.map((page, index) => {
        const source = bytes.get(page.sourceId);
        const isSelected = selected.has(page.id);
        const isDragging = drag !== null && drag.fromIndex === index;
        const isOver = drag !== null && drag.overIndex === index && !isDragging;

        return (
          <div
            key={page.id}
            data-page-index={index}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 6,
              background: isSelected ? primaryAlpha(0.1) : 'rgba(255,255,255,0.5)',
              border: `2px solid ${isOver ? color.primary : isSelected ? primaryAlpha(0.5) : 'rgba(255,255,255,0.7)'}`,
              opacity: isDragging ? 0.4 : 1,
              cursor: 'grab',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            {source !== undefined && (
              <PageThumbnail
                pageId={page.id}
                sourceId={page.sourceId}
                sourceIndex={page.sourceIndex}
                kind={source.kind}
                bytes={source.bytes}
                rotation={page.rotation}
              />
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 4,
                right: 6,
                fontSize: 11,
                fontFamily: font,
                fontWeight: 600,
                color: color.textSecondary,
                background: 'rgba(255,255,255,0.85)',
                borderRadius: 6,
                padding: '1px 5px',
              }}
            >
              {index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
