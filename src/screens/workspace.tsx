import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { RotateCcw, RotateCw, Trash2, ArrowDownUp, UploadCloud } from 'lucide-react';
import {
  Dropzone,
  ErrorText,
  GlassButton,
  GlassCard,
  ScreenHeader,
  Spinner,
  color,
  font,
  primaryAlpha,
} from 'meoweo-shared';

import { PageGrid } from '../components/page_grid';
import { ToolPanel } from '../components/tool_panel';
import { FILE_ACCEPT_ATTRIBUTE } from '../lib/file_type';
import {
  exportCompressed,
  exportExtracted,
  exportImages,
  exportMerged,
  exportSplit,
} from '../lib/exports';
import type { CompressionLevel } from '../lib/image_encode';
import { loadFiles } from '../lib/load_files';
import { validateAddition } from '../lib/pdf_limits';
import { deckUsage, useDeckStore } from '../store/deck.store';
import type { Screen } from '../lib/navigation';

const TITLES: Record<Screen, { title: string; subtitle: string }> = {
  organize: { title: 'Organize', subtitle: 'Drag pages to reorder. Merge, split or extract.' },
  convert: { title: 'Convert', subtitle: 'Images to PDF, or every page to an image.' },
  compress: { title: 'Compress', subtitle: 'Make a PDF smaller by re-encoding its pages.' },
  protect: { title: 'Protect', subtitle: 'Passwords and permissions.' },
};

const MB = 1024 * 1024;

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function Workspace({ screen }: { screen: Screen }): ReactElement {
  const { deck, bytes, selected, addSources, move, rotate, remove, reverse, toggleSelected } =
    useDeckStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const targets = selected.size > 0 ? [...selected] : deck.pages.map((page) => page.id);

  async function handleFiles(files: File[]): Promise<void> {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { loaded, failures } = await loadFiles(files);
      if (loaded.length > 0) {
        const incoming = {
          bytes: loaded.reduce((sum, item) => sum + item.source.bytes, 0),
          pages: loaded.reduce((sum, item) => sum + item.source.pageCount, 0),
          files: loaded.length,
        };
        const problem = validateAddition(deckUsage(), incoming, navigator.deviceMemory);
        if (problem !== null) {
          setError(problem);
          return;
        }
        addSources(loaded);
      }
      if (failures.length > 0) {
        setError(failures.map((f) => `${f.name}: ${f.message}`).join(' '));
      }
    } finally {
      setLoading(false);
    }
  }

  /** Every export runs through here so busy/progress/error handling exists once. */
  async function run(action: () => Promise<string | null>): Promise<void> {
    setBusy(true);
    setProgress(null);
    setError(null);
    setResult(null);
    try {
      setResult(await action());
    } catch (cause: unknown) {
      console.error('Export failed', cause);
      setError('That did not work. Try again, or with fewer pages.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const onProgress = (fraction: number): void => {
    setProgress(fraction);
  };

  if (deck.pages.length === 0) {
    return (
      <>
        <ScreenHeader title={TITLES[screen].title} subtitle={TITLES[screen].subtitle} />
        <GlassCard>
          <Dropzone
            onFiles={(files) => {
              void handleFiles(files);
            }}
            onReject={setError}
            prompt="Drop to add"
            onClick={() => inputRef.current?.click()}
            padding="34px 20px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {loading ? (
                <Spinner size={26} color={color.primary} />
              ) : (
                <UploadCloud size={32} color={primaryAlpha(0.38)} strokeWidth={1.5} />
              )}
              <p style={{ fontSize: 14, color: color.textSecondary, margin: 0, textAlign: 'center' }}>
                {loading ? 'Reading your files' : 'Drop PDFs or images here, or click to browse'}
              </p>
              <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>
                PDF, PNG, JPEG, WebP, GIF, BMP, TIFF — nothing is uploaded
              </p>
            </div>
          </Dropzone>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT_ATTRIBUTE}
            style={{ display: 'none' }}
            onChange={(e) => {
              void handleFiles([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </GlassCard>
        {error !== null && <ErrorText>{error}</ErrorText>}
      </>
    );
  }

  return (
    <>
      <ScreenHeader title={TITLES[screen].title} subtitle={TITLES[screen].subtitle} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: color.textMuted, fontFamily: font }}>
          {deck.pages.length} pages · {formatMb(deck.sources.reduce((s, x) => s + x.bytes, 0))}
          {selected.size > 0 ? ` · ${String(selected.size)} selected` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <GlassButton icon={RotateCcw} label="Left" onClick={() => { rotate(targets, -90); }} />
        <GlassButton icon={RotateCw} label="Right" onClick={() => { rotate(targets, 90); }} />
        <GlassButton icon={ArrowDownUp} label="Reverse" onClick={reverse} />
        <GlassButton icon={Trash2} label="Delete" onClick={() => { remove(targets); }} />
        <GlassButton icon={UploadCloud} label="Add files" onClick={() => { inputRef.current?.click(); }} />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <PageGrid
            deck={deck}
            bytes={bytes}
            selected={selected}
            onToggleSelected={toggleSelected}
            onMove={move}
          />
        </div>
        <div style={{ flex: '0 1 280px', minWidth: 240 }}>
          <ToolPanel
            screen={screen}
            deck={deck}
            selected={selected}
            busy={busy}
            progress={progress}
            error={error}
            result={result}
            onMerge={() => {
              void run(async () => {
                await exportMerged(deck, bytes, onProgress);
                return 'Merged PDF downloaded.';
              });
            }}
            onSplit={() => {
              void run(async () => {
                await exportSplit(deck, bytes, onProgress);
                return 'Split pages downloaded.';
              });
            }}
            onExtract={(indices) => {
              void run(async () => {
                await exportExtracted(deck, bytes, indices);
                return `Extracted ${String(indices.length)} pages.`;
              });
            }}
            onImages={(format) => {
              void run(async () => {
                await exportImages(deck, bytes, format, onProgress);
                return 'Images downloaded.';
              });
            }}
            onCompress={(level: CompressionLevel) => {
              void run(async () => {
                const { before, after } = await exportCompressed(deck, bytes, level, onProgress);
                return `${formatMb(before)} → ${formatMb(after)}`;
              });
            }}
          />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTRIBUTE}
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </>
  );
}
