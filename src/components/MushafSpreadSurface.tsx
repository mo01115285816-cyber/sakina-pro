import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import SakeenahLineSpinner from '@/components/SakeenahLineSpinner';
import { prefetchQcfFont } from '@/hooks/useQcfFont';
import { MushafQcfV2LayoutService } from '@/services/MushafQcfV2LayoutService';
import type { MushafQcfV2Page, MushafQcfV2Word } from '@/services/MushafQcfV2LayoutService';
import type { MushafSpreadPlan } from '@/services/MushafSpreadPlanner';
import MushafPageRenderer from './MushafPageRenderer';
import type { MushafPageRenderStatus, MushafPageTheme } from './MushafPageRenderer';

interface Props {
  plan: MushafSpreadPlan;
  activePageData: MushafQcfV2Page | null;
  theme: MushafPageTheme;
  loadingAccentClassName: string;
  highlightedVerseKey: string | null;
  selectedVerseKey: string | null;
  playingVerseKey: string | null;
  onWordLongPressStart: (
    pageNumber: number,
    word: MushafQcfV2Word,
    event: React.TouchEvent | React.MouseEvent,
  ) => void;
  onWordLongPressEnd: () => void;
}

/**
 * Coordinates a complete atomic page view. It receives calculated page slots,
 * mounts only the visible pages, and exposes neither automatic flex ordering nor
 * font logic to the spread planner.
 */
export default function MushafSpreadSurface({
  plan,
  activePageData,
  theme,
  loadingAccentClassName,
  highlightedVerseKey,
  selectedVerseKey,
  playingVerseKey,
  onWordLongPressStart,
  onWordLongPressEnd,
}: Props) {
  const pageNumbers = useMemo(() => plan.slots.map((slot) => slot.pageNumber), [plan.slots]);
  const [statuses, setStatuses] = useState<Record<number, MushafPageRenderStatus>>({});

  const handleStatusChange = useCallback((status: MushafPageRenderStatus) => {
    setStatuses((current) => {
      const existing = current[status.pageNumber];
      if (existing?.ready === status.ready && existing?.error === status.error) return current;
      return { ...current, [status.pageNumber]: status };
    });
  }, []);

  useEffect(() => {
    // One visible spread plus one preceding and one following spread is the full
    // bounded prefetch window. No unbounded page or font population is allowed.
    const candidates = plan.mode === 'spread'
      ? [plan.anchorPage - 2, plan.anchorPage - 1, plan.anchorPage + 2, plan.anchorPage + 3]
      : [plan.activePage - 1, plan.activePage + 1];

    for (const pageNumber of candidates) {
      if (pageNumber < 1 || pageNumber > 604 || pageNumbers.includes(pageNumber)) continue;
      prefetchQcfFont(pageNumber);
      MushafQcfV2LayoutService.prefetchPage(pageNumber);
    }
  }, [pageNumbers, plan.activePage, plan.anchorPage, plan.mode]);

  const pageError = pageNumbers
    .map((pageNumber) => statuses[pageNumber]?.error)
    .find((error): error is string => Boolean(error));
  const isReady = !pageError && pageNumbers.every((pageNumber) => statuses[pageNumber]?.ready === true);

  return (
    <div
      className="mushaf-spread-surface"
      data-mushaf-display-mode={plan.mode}
      data-mushaf-anchor-page={plan.anchorPage}
      aria-busy={!isReady}
    >
      <div
        className={`mushaf-spread-pages ${isReady ? 'mushaf-spread-pages--ready' : 'mushaf-spread-pages--pending'}`}
        aria-hidden={!isReady}
      >
        {plan.slots.map((slot) => (
          <div
            key={`page-slot-${slot.pageNumber}`}
            className={`mushaf-page-slot mushaf-page-slot--${slot.side}`}
            data-mushaf-page-slot={slot.side}
            style={{
              left: `${slot.left}px`,
              top: `${slot.top}px`,
              width: `${slot.width}px`,
              height: `${slot.height}px`,
            }}
          >
            <MushafPageRenderer
              pageNumber={slot.pageNumber}
              fontSize={slot.fontSize}
              theme={theme}
              initialPageData={slot.pageNumber === activePageData?.page ? activePageData : null}
              highlightedVerseKey={highlightedVerseKey}
              selectedVerseKey={selectedVerseKey}
              playingVerseKey={playingVerseKey}
              onStatusChange={handleStatusChange}
              onWordLongPressStart={onWordLongPressStart}
              onWordLongPressEnd={onWordLongPressEnd}
            />
          </div>
        ))}
      </div>

      {!isReady && (
        <div className="mushaf-spread-loader" role="status" aria-live="polite">
          {pageError ? (
            <>
              <AlertCircle className={loadingAccentClassName} size={36} />
              <span className="text-xs font-sans opacity-70">تعذر تجهيز صفحتي المصحف بالخط المعتمد.</span>
            </>
          ) : (
            <>
              <SakeenahLineSpinner size={40} color="currentColor" label="جارٍ تجهيز صفحات المصحف" />
              <span className="text-xs font-sans opacity-60">جاري تجهيز صفحات المصحف...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
