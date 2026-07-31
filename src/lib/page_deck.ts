import type { FileKind } from './file_type.js';

/**
 * The page deck: one ordered list of pages drawn from every file that was dropped.
 *
 * This is the single source of truth. Reordering, rotating and deleting all happen here, and the
 * export walks this same list – so what the grid shows is exactly what comes out. Nothing else may
 * hold an opinion about page order.
 *
 * Pages are immutable values with a stable `id`. The id is what React keys on and what a drag
 * moves; it never encodes position, because a key derived from position breaks the drag the moment
 * the list reorders.
 */

/** Rotation is stored in whole quarter turns, always normalized to 0/90/180/270. */
export type Rotation = 0 | 90 | 180 | 270;

export type DeckPage = {
  /** Stable identity, unique within the deck. */
  id: string;
  /** Which loaded source this page came from. */
  sourceId: string;
  /** Page index inside its source PDF; always 0 for an image. */
  sourceIndex: number;
  rotation: Rotation;
};

export type DeckSource = {
  id: string;
  name: string;
  kind: FileKind;
  bytes: number;
  /** Pages this source contributed when it was loaded. */
  pageCount: number;
};

export type Deck = {
  sources: DeckSource[];
  pages: DeckPage[];
};

export const EMPTY_DECK: Deck = { sources: [], pages: [] };

const QUARTER_TURN = 90;
const FULL_TURN = 360;

/**
 * Normalize any angle to the four rotations a PDF page can carry.
 *
 * @param degrees - Any angle, positive or negative.
 * @returns The equivalent 0, 90, 180 or 270.
 */
export function normalizeRotation(degrees: number): Rotation {
  const turns = Math.round(degrees / QUARTER_TURN) * QUARTER_TURN;
  const wrapped = ((turns % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return wrapped as Rotation;
}

/** The id for a page, derived from its origin so a reload of the same file is stable. */
export function pageId(sourceId: string, sourceIndex: number): string {
  return `${sourceId}:${String(sourceIndex)}`;
}

/**
 * Append a newly loaded file's pages to the end of the deck.
 *
 * @param deck - The current deck.
 * @param source - The file that was loaded.
 * @returns A new deck with the source and its pages appended.
 */
export function addSource(deck: Deck, source: DeckSource): Deck {
  const pages = Array.from({ length: source.pageCount }, (_, index) => ({
    id: pageId(source.id, index),
    sourceId: source.id,
    sourceIndex: index,
    rotation: 0 as Rotation,
  }));
  return { sources: [...deck.sources, source], pages: [...deck.pages, ...pages] };
}

/**
 * Move one page to another position, shifting the rest.
 *
 * @param deck - The current deck.
 * @param from - Index being dragged.
 * @param to - Index it is dropped on.
 * @returns A new deck with the page moved; unchanged when either index is out of range.
 */
export function movePage(deck: Deck, from: number, to: number): Deck {
  const { pages } = deck;
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) {
    return deck;
  }
  const next = [...pages];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return deck;
  }
  next.splice(to, 0, moved);
  return { ...deck, pages: next };
}

/**
 * Turn the given pages by a quarter turn (or several).
 *
 * @param deck - The current deck.
 * @param ids - Pages to turn; others are untouched.
 * @param degrees - How far to turn, e.g. 90 or -90.
 * @returns A new deck with those pages rotated.
 */
export function rotatePages(deck: Deck, ids: readonly string[], degrees: number): Deck {
  const targets = new Set(ids);
  return {
    ...deck,
    pages: deck.pages.map((page) =>
      targets.has(page.id)
        ? { ...page, rotation: normalizeRotation(page.rotation + degrees) }
        : page,
    ),
  };
}

/**
 * Drop the given pages, and any source left with no pages.
 *
 * @param deck - The current deck.
 * @param ids - Pages to remove.
 * @returns A new deck without them.
 */
export function removePages(deck: Deck, ids: readonly string[]): Deck {
  const targets = new Set(ids);
  const pages = deck.pages.filter((page) => !targets.has(page.id));
  const stillUsed = new Set(pages.map((page) => page.sourceId));
  return { sources: deck.sources.filter((source) => stillUsed.has(source.id)), pages };
}

/**
 * Reverse the whole deck – the cheap way to fix a back-to-front scan.
 *
 * @param deck - The current deck.
 * @returns A new deck in the opposite order.
 */
export function reverseDeck(deck: Deck): Deck {
  return { ...deck, pages: [...deck.pages].reverse() };
}

/** Total bytes loaded, for the memory guard and the size readout. */
export function totalBytes(deck: Deck): number {
  return deck.sources.reduce((sum, source) => sum + source.bytes, 0);
}
