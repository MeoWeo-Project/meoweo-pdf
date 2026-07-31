# meoweo-pdf

Browser-side PDF and image tools — **no upload, no server**. Every file stays in the tab.

Deployed at `pdf.meoweo.com`. UI comes from
[meoweo-shared](https://github.com/MeoWeo-Project/meoweo-shared).

> **Status: foundation.** The pure logic below is written and tested (65 tests). The React screens,
> the pdf.js render worker and the export paths are not built yet — see [Remaining](#remaining).

## The idea

Drop any mix of PDFs and images. The type is detected **from the bytes**, every PDF page and every
image becomes one card in a single ordered grid, and you drag the cards into the order you want.
Every tool then operates on that one list.

## The core rule: the deck is the only source of truth

`lib/page_deck.ts` holds one ordered list of pages. Reorder, rotate and delete all happen there, and
every export walks that same list — so **what the grid shows is exactly what comes out**. Nothing
else may hold an opinion about page order.

Pages carry a stable `id` (`sourceId:index`) that never encodes position. That matters: a card keyed
by its own position becomes a new element on every pointermove, and the drag capture dies with the
old one. This is the same lesson `usePointerDrag` in `meoweo-shared` exists to encode.

## Licensing — permissive only, on purpose

| Package | Licence | Role |
|---|---|---|
| `pdfjs-dist` | Apache-2.0 | render pages → thumbnails, PDF→image |
| `@cantoo/pdf-lib` | MIT | merge, split, rotate, stamp, metadata, **open** encrypted PDFs |
| `fflate` | MIT | zip multi-file output |

**MuPDF and Ghostscript are excluded deliberately — both are AGPL**, which would force this app's
entire source to be published. That is the same copyleft trap the audio suite escaped with ffmpeg.

**Verified:** `@cantoo/pdf-lib` can *decrypt* a password-protected PDF (`PDFDocument.load(bytes,
{ password })`) but **cannot encrypt one**. So "remove password" needs no extra dependency, while
"set password" will need `@jspawn/qpdf-wasm` (Apache-2.0, AES-256). That dependency is not installed
yet — it lands with the protect tool, not before.

## Built and tested

| Module | What it owns |
|---|---|
| `lib/file_type.ts` | magic-byte detection; trusts bytes over the extension, and does not mistake a WAV's `RIFF` header for a WebP |
| `lib/page_deck.ts` | the ordered deck: add, move, rotate, remove, reverse — all immutable |
| `lib/page_ranges.ts` | `1-3, 7` ⇄ zero-based indices; the 1-based/0-based boundary lives here alone |
| `lib/pdf_limits.ts` | memory guards (bytes **and** page count), halved on low-memory devices |

Pure logic, tested in Node — no browser needed, same convention as the audio suite.

## Remaining

1. **Render worker** — pdf.js in a Web Worker producing thumbnails; cache keyed by page id, cards virtualized.
2. **Deck UI** — the card grid, drag-reorder via `usePointerDrag`, selection, rotate/delete toolbar.
3. **Organize** — merge (already implicit in the deck), split/extract using `page_ranges`.
4. **Convert** — images → PDF (`pdf-lib` embed), PDF → images (pdf.js render → canvas → `fflate` zip).
5. **Compress** — re-encode embedded images through canvas; report before/after.
6. **Protect + stamp** — add `@jspawn/qpdf-wasm` for encryption; page numbers, watermark, metadata.

## Develop

```sh
npm install
npm run typecheck && npm run lint && npm test
npm run build
```

## Deploy

Static build on Cloudflare Pages. `public/_headers` **must** keep `script-src 'wasm-unsafe-eval'`
and `worker-src 'self' blob:` — pdf.js and qpdf both run WebAssembly in workers.
`public/_redirects` provides the SPA fallback.
