import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  ChoiceChips,
  ErrorText,
  GlassCard,
  GlassInput,
  PrimaryButton,
  ProgressBar,
  color,
  font,
} from 'meoweo-shared';

import { COMPRESSION_LEVELS } from '../lib/image_encode';
import type { CompressionLevel } from '../lib/image_encode';
import { formatPageRanges, parsePageRanges } from '../lib/page_ranges';
import type { Deck } from '../lib/page_deck';
import type { Screen } from '../lib/navigation';

const PROTECT_UNAVAILABLE =
  'Password protection needs an encryption engine that is not bundled yet (qpdf, Apache-2.0). Opening an already-protected PDF is supported.';

type Props = {
  screen: Screen;
  deck: Deck;
  selected: ReadonlySet<string>;
  busy: boolean;
  progress: number | null;
  error: string | null;
  result: string | null;
  onMerge: () => void;
  onSplit: () => void;
  onExtract: (indices: number[]) => void;
  onImages: (format: 'png' | 'jpeg') => void;
  onCompress: (level: CompressionLevel) => void;
};

function Label({ children }: { children: string }): ReactElement {
  return (
    <p style={{ fontSize: 12, color: color.textMuted, fontFamily: font, margin: '0 0 8px' }}>
      {children}
    </p>
  );
}

/** The action panel: same deck, different verbs. */
export function ToolPanel(props: Props): ReactElement {
  const { screen, deck, selected, busy, progress, error, result } = props;
  const [ranges, setRanges] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('balanced');
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('jpeg');

  const empty = deck.pages.length === 0;

  function handleExtract(): void {
    const text = ranges.trim() === '' ? formatPageRanges(indicesOfSelected()) : ranges;
    const parsed = parsePageRanges(text, deck.pages.length);
    if ('error' in parsed) {
      setRangeError(parsed.error);
      return;
    }
    setRangeError(null);
    props.onExtract(parsed.indices);
  }

  function indicesOfSelected(): number[] {
    return deck.pages.reduce<number[]>((out, page, index) => {
      if (selected.has(page.id)) {
        out.push(index);
      }
      return out;
    }, []);
  }

  return (
    <GlassCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 4 }}>
        {screen === 'organize' && (
          <>
            <Label>Combine every page, in the order shown, into one PDF.</Label>
            <PrimaryButton disabled={busy || empty} onClick={props.onMerge}>
              Merge into one PDF
            </PrimaryButton>
            <Label>Or write each page out as its own PDF.</Label>
            <PrimaryButton disabled={busy || empty} onClick={props.onSplit}>
              Split into single pages
            </PrimaryButton>
            <Label>Or keep only some pages. Leave blank to use your selection.</Label>
            <GlassInput
              value={ranges}
              placeholder="1-3, 7"
              onChange={(e) => {
                setRanges(e.target.value);
              }}
            />
            {rangeError !== null && <ErrorText>{rangeError}</ErrorText>}
            <PrimaryButton disabled={busy || empty} onClick={handleExtract}>
              Extract pages
            </PrimaryButton>
          </>
        )}

        {screen === 'convert' && (
          <>
            <Label>Turn every page into an image. Images download as a zip.</Label>
            <ChoiceChips
              options={[
                { value: 'jpeg' as const, label: 'JPEG' },
                { value: 'png' as const, label: 'PNG' },
              ]}
              value={imageFormat}
              ariaLabel="Image format"
              onSelect={(value) => {
                setImageFormat(value);
              }}
            />
            <PrimaryButton
              disabled={busy || empty}
              onClick={() => {
                props.onImages(imageFormat);
              }}
            >
              Convert to images
            </PrimaryButton>
            <Label>Images you dropped are already pages — merge to get a PDF of them.</Label>
            <PrimaryButton disabled={busy || empty} onClick={props.onMerge}>
              Convert to PDF
            </PrimaryButton>
          </>
        )}

        {screen === 'compress' && (
          <>
            <Label>Pages are re-encoded as images. Stronger means smaller and softer.</Label>
            <ChoiceChips
              options={COMPRESSION_LEVELS.map((value) => ({ value, label: value }))}
              value={level}
              ariaLabel="Compression level"
              onSelect={(value) => {
                setLevel(value);
              }}
            />
            <PrimaryButton
              disabled={busy || empty}
              onClick={() => {
                props.onCompress(level);
              }}
            >
              Compress PDF
            </PrimaryButton>
          </>
        )}

        {screen === 'protect' && (
          <>
            <Label>{PROTECT_UNAVAILABLE}</Label>
            <PrimaryButton disabled>Set a password</PrimaryButton>
          </>
        )}

        {busy && <ProgressBar value={progress} label="Working" />}
        {error !== null && <ErrorText>{error}</ErrorText>}
        {result !== null && (
          <p style={{ fontSize: 12, color: color.success, fontFamily: font, margin: 0 }}>{result}</p>
        )}
      </div>
    </GlassCard>
  );
}
