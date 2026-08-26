import React, { useEffect, useMemo, useState } from 'react';
import { surahNames } from '@/data/surahNames';
import { vocalizedSurahNames } from '@/data/vocalizedSurahNames';
import { useQcfFont } from '@/hooks/useQcfFont';
import { MushafQcfV2LayoutService } from '@/services/MushafQcfV2LayoutService';
import type { MushafQcfV2Page, MushafQcfV2Word } from '@/services/MushafQcfV2LayoutService';
import { publicAssetUrl } from '@/utils/publicAssetUrl';

const SURAH_HEADER_FRAME_SRC = publicAssetUrl('images/quran/surah-header-frame.webp');
const SURAH_HEADER_FRAME_WIDTH = 2400;
const SURAH_HEADER_FRAME_HEIGHT = 775;

const surahHeaderFramePreload = typeof Image !== 'undefined' ? new Image() : null;
if (surahHeaderFramePreload) {
  surahHeaderFramePreload.decoding = 'sync';
  surahHeaderFramePreload.src = SURAH_HEADER_FRAME_SRC;
  void surahHeaderFramePreload.decode?.().catch(() => undefined);
}

export interface MushafPageTheme {
  accent: string;
  highlight: string;
  playing: string;
  hover: string;
  accentLight: string;
}

export interface MushafPageRenderStatus {
  pageNumber: number;
  ready: boolean;
  error: string | null;
}

interface Props {
  pageNumber: number;
  fontSize: number;
  theme: MushafPageTheme;
  highlightedVerseKey: string | null;
  selectedVerseKey: string | null;
  playingVerseKey: string | null;
  initialPageData?: MushafQcfV2Page | null;
  onStatusChange: (status: MushafPageRenderStatus) => void;
  onWordLongPressStart: (
    pageNumber: number,
    word: MushafQcfV2Word,
    event: React.TouchEvent | React.MouseEvent,
  ) => void;
  onWordLongPressEnd: () => void;
}

function getVerseKey(word: MushafQcfV2Word): string | null {
  const parts = word.location?.split(':');
  return parts && parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
}

function toArabicPageDigits(pageNumber: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(pageNumber).replace(/\d/g, (digit) => digits[Number(digit)]);
}

/**
 * A page-only renderer. It owns one QCF page's data and page font, but has no
 * knowledge of whether its parent is displaying a single page or a spread.
 */
export default function MushafPageRenderer({
  pageNumber,
  fontSize,
  theme,
  highlightedVerseKey,
  selectedVerseKey,
  playingVerseKey,
  initialPageData,
  onStatusChange,
  onWordLongPressStart,
  onWordLongPressEnd,
}: Props) {
  const [pageData, setPageData] = useState<MushafQcfV2Page | null>(
    initialPageData?.page === pageNumber ? initialPageData : null,
  );
  const [dataError, setDataError] = useState<string | null>(null);
  const isPageFontLoaded = useQcfFont(pageNumber);
  const isBasmalaFontLoaded = useQcfFont(1);

  useEffect(() => {
    if (initialPageData?.page === pageNumber) {
      setPageData(initialPageData);
      setDataError(null);
      return;
    }

    // The active page can move from the right slot to the left slot of the
    // same spread. Keep the already validated resource mounted in that case.
    if (pageData?.page === pageNumber) return;

    let mounted = true;
    setPageData(null);
    setDataError(null);

    MushafQcfV2LayoutService.getPage(pageNumber)
      .then((page) => {
        if (mounted) setPageData(page);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setDataError(error instanceof Error ? error.message : `تعذر تحميل صفحة المصحف ${pageNumber}`);
      });

    return () => {
      mounted = false;
    };
  }, [initialPageData, pageData?.page, pageNumber]);

  const lines = useMemo(() => pageData?.lines ?? [], [pageData]);
  const needsBasmalaFont = lines.some((line) => line.type === 'basmala');
  const isReady = Boolean(pageData && isPageFontLoaded && (!needsBasmalaFont || isBasmalaFontLoaded));

  useEffect(() => {
    onStatusChange({
      pageNumber,
      ready: isReady,
      error: dataError,
    });
  }, [dataError, isReady, onStatusChange, pageNumber]);

  if (!pageData || !isReady) return null;

  const qcfFontFamily = `QCF_P${String(pageNumber).padStart(3, '0')}`;
  const isOpeningPage = pageNumber === 1 || pageNumber === 2;
  const renderedLines = isOpeningPage ? lines.filter((line) => line.type !== 'empty') : lines;

  const renderLine = (lineObj: MushafQcfV2Page['lines'][number]) => {
    const lineNum = lineObj.line;

    if (lineObj.type === 'surah-header' && lineObj.surah) {
      const surahChapterId = parseInt(lineObj.surah, 10);
      const headerLabel = vocalizedSurahNames[surahChapterId]
        || lineObj.text?.trim()
        || `سُورَةُ ${surahNames[surahChapterId] || ''}`;
      const isLongHeaderName = (surahNames[surahChapterId] || '').length >= 10;

      return (
        <div key={`line-${lineNum}`} className="surah-header-line">
          <div className="surah-frame" aria-label={headerLabel}>
            <img
              className="surah-frame__art"
              src={SURAH_HEADER_FRAME_SRC}
              width={SURAH_HEADER_FRAME_WIDTH}
              height={SURAH_HEADER_FRAME_HEIGHT}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="sync"
              fetchPriority="high"
              draggable={false}
            />
            <span
              className={`surah-frame__title ${isLongHeaderName ? 'surah-frame__title--long' : ''}`}
              dir="rtl"
            >
              {headerLabel}
            </span>
          </div>
        </div>
      );
    }

    if (lineObj.type === 'basmala' && lineObj.qpcV2) {
      return (
        <div key={`line-${lineNum}`} className="qcf-line qcf-basmala qcf-centered" style={{ fontFamily: 'QCF_P001' }}>
          {lineObj.qpcV2}
        </div>
      );
    }

    if (lineObj.type === 'text' && lineObj.words) {
      return (
        <div key={`line-${lineNum}`} className={`qcf-line ${lineObj.isCentered ? 'qcf-centered' : 'qcf-justified'}`}>
          {lineObj.words.map((word, wordIndex) => {
            const verseKey = getVerseKey(word) || '';
            const isSelected = selectedVerseKey === verseKey;
            const isHighlighted = highlightedVerseKey === verseKey;
            const isPlayingVerse = playingVerseKey === verseKey;
            const isEnd = word.charType === 'end' || /\d+$/.test(word.word) || /[\u0660-\u0669]$/.test(word.word);
            const className = [
              'qcf-word',
              isEnd ? 'qcf-end-mark' : '',
              (isHighlighted || isSelected) ? 'qcf-highlighted' : '',
              isPlayingVerse ? 'qcf-playing' : '',
            ].filter(Boolean).join(' ');

            return (
              <span
                key={`${lineNum}-${wordIndex}`}
                className={className}
                onTouchStart={(event) => onWordLongPressStart(pageNumber, word, event)}
                onTouchEnd={(event) => { event.stopPropagation(); onWordLongPressEnd(); }}
                onTouchCancel={(event) => { event.stopPropagation(); onWordLongPressEnd(); }}
                onTouchMove={(event) => { event.stopPropagation(); onWordLongPressEnd(); }}
                onMouseDown={(event) => onWordLongPressStart(pageNumber, word, event)}
                onMouseUp={(event) => { event.stopPropagation(); onWordLongPressEnd(); }}
                onMouseLeave={onWordLongPressEnd}
                onClick={(event) => event.stopPropagation()}
              >
                {word.qpcV2}
              </span>
            );
          })}
        </div>
      );
    }

    return <div key={`line-${lineNum}`} className="qcf-empty" aria-hidden="true" />;
  };

  return (
    <div
      className={`qcf-page select-none ${isOpeningPage ? 'qcf-opening-page' : ''}`}
      data-mushaf-page={pageNumber}
      aria-label={`صفحة المصحف ${pageNumber}`}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        fontFamily: qcfFontFamily,
        ['--qcf-font-size' as any]: `${fontSize}px`,
        ['--qcf-accent' as any]: theme.accent,
        ['--qcf-highlight' as any]: theme.highlight,
        ['--qcf-playing' as any]: theme.playing,
        ['--qcf-hover' as any]: theme.hover,
        ['--qcf-accent-light' as any]: theme.accentLight,
      }}
    >
      {isOpeningPage ? (
        <div className="qcf-opening-content">
          {renderedLines.map(renderLine)}
        </div>
      ) : (
        renderedLines.map(renderLine)
      )}
      {isOpeningPage && (
        <div className="qcf-opening-folio" aria-label={`رقم الصفحة ${toArabicPageDigits(pageNumber)}`}>
          {toArabicPageDigits(pageNumber)}
        </div>
      )}
    </div>
  );
}
