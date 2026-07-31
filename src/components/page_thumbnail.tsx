import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { openPdf, renderPageToCanvas } from '../lib/pdf_engine';
import { isImageKind } from '../lib/file_type';
import type { FileKind } from '../lib/file_type';

/** Width the thumbnails are rendered at; cards are laid out around this. */
export const THUMB_WIDTH = 150;

/**
 * One rendered page image.
 *
 * Renders are cached across the session by page id: scrolling a hundred-page document back and
 * forth must not re-rasterize every card, and pdf.js parsing is the expensive part.
 */
const cache = new Map<string, string>();

type Props = {
  pageId: string;
  sourceId: string;
  sourceIndex: number;
  kind: FileKind;
  bytes: Uint8Array;
  rotation: number;
};

async function renderThumb(props: Props): Promise<string> {
  if (isImageKind(props.kind)) {
    const blob = new Blob([props.bytes.slice().buffer]);
    return URL.createObjectURL(blob);
  }
  const { pdf, close } = await openPdf(props.bytes);
  try {
    const canvas = await renderPageToCanvas(pdf, props.sourceIndex + 1, THUMB_WIDTH);
    return canvas.toDataURL('image/png');
  } finally {
    await close();
  }
}

export function PageThumbnail(props: Props): ReactElement {
  const [url, setUrl] = useState<string | null>(() => cache.get(props.pageId) ?? null);

  useEffect(() => {
    if (cache.has(props.pageId)) {
      setUrl(cache.get(props.pageId) ?? null);
      return;
    }
    let live = true;
    void renderThumb(props).then((rendered) => {
      cache.set(props.pageId, rendered);
      if (live) {
        setUrl(rendered);
      }
    });
    return () => {
      live = false;
    };
    // Only the identity of the page matters; rotation is applied with CSS, not a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pageId]);

  if (url === null) {
    return <div style={{ width: '100%', aspectRatio: '3 / 4', background: 'rgba(0,0,0,0.04)' }} />;
  }

  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        width: '100%',
        display: 'block',
        transform: `rotate(${String(props.rotation)}deg)`,
        transition: 'transform 0.15s',
      }}
    />
  );
}
