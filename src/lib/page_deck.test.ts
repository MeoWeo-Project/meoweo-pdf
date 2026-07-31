import { describe, expect, it } from 'vitest';

import {
  EMPTY_DECK,
  addSource,
  movePage,
  normalizeRotation,
  removePages,
  reverseDeck,
  rotatePages,
  totalBytes,
} from './page_deck';
import type { Deck, DeckSource } from './page_deck';

function source(id: string, pageCount: number, bytes = 1000): DeckSource {
  return { id, name: `${id}.pdf`, kind: 'pdf', bytes, pageCount };
}

/** A deck of two files: a-0 a-1 a-2, then b-0 b-1. */
function sampleDeck(): Deck {
  return addSource(addSource(EMPTY_DECK, source('a', 3)), source('b', 2));
}

const ids = (deck: Deck): string[] => deck.pages.map((p) => p.id);

describe('normalizeRotation', () => {
  it('keeps the four legal rotations', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
  });

  it('wraps past a full turn', () => {
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
  });

  it('wraps negatives forward, so turning left from 0 lands on 270', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-360)).toBe(0);
    expect(normalizeRotation(-450)).toBe(270);
  });
});

describe('addSource', () => {
  it('appends one page per source page, in order', () => {
    expect(ids(sampleDeck())).toEqual(['a:0', 'a:1', 'a:2', 'b:0', 'b:1']);
  });

  it('gives every page a distinct id', () => {
    const deck = sampleDeck();
    expect(new Set(ids(deck)).size).toBe(deck.pages.length);
  });

  it('starts every page unrotated', () => {
    expect(sampleDeck().pages.every((p) => p.rotation === 0)).toBe(true);
  });

  it('does not mutate the deck it was given', () => {
    const before = sampleDeck();
    const snapshot = ids(before);
    addSource(before, source('c', 1));
    expect(ids(before)).toEqual(snapshot);
  });
});

describe('movePage', () => {
  it('moves a page forward, shifting the rest back', () => {
    expect(ids(movePage(sampleDeck(), 0, 2))).toEqual(['a:1', 'a:2', 'a:0', 'b:0', 'b:1']);
  });

  it('moves a page backward', () => {
    expect(ids(movePage(sampleDeck(), 4, 0))).toEqual(['b:1', 'a:0', 'a:1', 'a:2', 'b:0']);
  });

  it('is a no-op when the indices match', () => {
    expect(ids(movePage(sampleDeck(), 2, 2))).toEqual(ids(sampleDeck()));
  });

  it('ignores out-of-range indices rather than losing a page', () => {
    const deck = sampleDeck();
    expect(ids(movePage(deck, -1, 2))).toEqual(ids(deck));
    expect(ids(movePage(deck, 0, 99))).toEqual(ids(deck));
  });

  it('never changes how many pages there are', () => {
    expect(movePage(sampleDeck(), 3, 1).pages).toHaveLength(5);
  });
});

describe('rotatePages', () => {
  it('turns only the named pages', () => {
    const deck = rotatePages(sampleDeck(), ['a:1'], 90);
    expect(deck.pages.map((p) => p.rotation)).toEqual([0, 90, 0, 0, 0]);
  });

  it('accumulates across calls and wraps', () => {
    let deck = sampleDeck();
    for (let i = 0; i < 4; i++) {
      deck = rotatePages(deck, ['a:0'], 90);
    }
    expect(deck.pages[0]?.rotation).toBe(0);
  });

  it('turns left', () => {
    expect(rotatePages(sampleDeck(), ['a:0'], -90).pages[0]?.rotation).toBe(270);
  });

  it('can turn several pages at once', () => {
    const deck = rotatePages(sampleDeck(), ['a:0', 'b:1'], 180);
    expect(deck.pages.map((p) => p.rotation)).toEqual([180, 0, 0, 0, 180]);
  });
});

describe('removePages', () => {
  it('drops the named pages and keeps the order of the rest', () => {
    expect(ids(removePages(sampleDeck(), ['a:1', 'b:0']))).toEqual(['a:0', 'a:2', 'b:1']);
  });

  it('drops a source once its last page is gone', () => {
    const deck = removePages(sampleDeck(), ['b:0', 'b:1']);
    expect(deck.sources.map((s) => s.id)).toEqual(['a']);
  });

  it('keeps a source that still has pages', () => {
    const deck = removePages(sampleDeck(), ['a:0']);
    expect(deck.sources.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('empties cleanly', () => {
    const deck = removePages(sampleDeck(), ids(sampleDeck()));
    expect(deck.pages).toHaveLength(0);
    expect(deck.sources).toHaveLength(0);
  });
});

describe('reverseDeck', () => {
  it('reverses the page order', () => {
    expect(ids(reverseDeck(sampleDeck()))).toEqual(['b:1', 'b:0', 'a:2', 'a:1', 'a:0']);
  });

  it('round-trips', () => {
    expect(ids(reverseDeck(reverseDeck(sampleDeck())))).toEqual(ids(sampleDeck()));
  });
});

describe('totalBytes', () => {
  it('sums the loaded sources', () => {
    expect(totalBytes(sampleDeck())).toBe(2000);
  });

  it('is zero for an empty deck', () => {
    expect(totalBytes(EMPTY_DECK)).toBe(0);
  });
});
