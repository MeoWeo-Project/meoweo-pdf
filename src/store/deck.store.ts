import { create } from 'zustand';

import type { FileKind } from '../lib/file_type';
import type { LoadedSource } from '../lib/load_files';
import {
  EMPTY_DECK,
  addSource,
  movePage,
  removePages,
  reverseDeck,
  rotatePages,
  totalBytes,
} from '../lib/page_deck';
import type { Deck } from '../lib/page_deck';

/**
 * The deck, and the bytes behind it.
 *
 * Page order lives in `deck`; the raw bytes live beside it in a plain Map because they are large,
 * never rendered, and must not make React re-render when they change.
 */
type DeckState = {
  deck: Deck;
  bytes: Map<string, { kind: FileKind; bytes: Uint8Array }>;
  selected: Set<string>;

  addSources: (loaded: readonly LoadedSource[]) => void;
  move: (from: number, to: number) => void;
  rotate: (ids: readonly string[], degrees: number) => void;
  remove: (ids: readonly string[]) => void;
  reverse: () => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  reset: () => void;
};

export const useDeckStore = create<DeckState>((set) => ({
  deck: EMPTY_DECK,
  bytes: new Map(),
  selected: new Set(),

  addSources: (loaded) => {
    set((state) => {
      const bytes = new Map(state.bytes);
      let deck = state.deck;
      for (const item of loaded) {
        bytes.set(item.source.id, { kind: item.kind, bytes: item.bytes });
        deck = addSource(deck, item.source);
      }
      return { deck, bytes };
    });
  },

  move: (from, to) => {
    set((state) => ({ deck: movePage(state.deck, from, to) }));
  },

  rotate: (ids, degrees) => {
    set((state) => ({ deck: rotatePages(state.deck, ids, degrees) }));
  },

  remove: (ids) => {
    set((state) => {
      const deck = removePages(state.deck, ids);
      const kept = new Set(deck.sources.map((source) => source.id));
      const bytes = new Map([...state.bytes].filter(([id]) => kept.has(id)));
      const selected = new Set([...state.selected].filter((id) => !ids.includes(id)));
      return { deck, bytes, selected };
    });
  },

  reverse: () => {
    set((state) => ({ deck: reverseDeck(state.deck) }));
  },

  toggleSelected: (id) => {
    set((state) => {
      const selected = new Set(state.selected);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return { selected };
    });
  },

  selectAll: () => {
    set((state) => ({ selected: new Set(state.deck.pages.map((page) => page.id)) }));
  },

  clearSelection: () => {
    set({ selected: new Set() });
  },

  reset: () => {
    set({ deck: EMPTY_DECK, bytes: new Map(), selected: new Set() });
  },
}));

/** Bytes and page counts, for the memory guard. */
export function deckUsage(): { bytes: number; pages: number } {
  const { deck } = useDeckStore.getState();
  return { bytes: totalBytes(deck), pages: deck.pages.length };
}
