import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  GraduationCap,
  LibraryBig,
  ListVideo,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { getPublishedScholars } from "@/data/sakinaLibraryCatalog";
import type {
  SakinaLessonItem,
  SakinaLessonSeries,
  SakinaScholar,
} from "@/types/sakina-library";

interface SakinaLibraryScreenProps {
  onBack?: () => void;
  onHideNavChange?: (hide: boolean) => void;
}

type LibraryView = "library" | "scholar" | "series" | "lesson" | "saved";

const SAVED_LESSONS_KEY = "sakeenah_lesson_bookmarks_v1";
const PROGRESS_KEY = "sakeenah_lesson_progress_v1";

function readStringSet(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}");
    return value && typeof value === "object" ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function formatDuration(seconds?: number) {
  if (!Number.isFinite(seconds) || !seconds || seconds < 1) return "المدة غير متاحة";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function verifiedLabel(status: SakinaScholar["verificationStatus"]) {
  return status === "verified" ? "مصدر موثوق" : "قيد المراجعة";
}

export default function SakinaLibraryScreen({
  onBack,
  onHideNavChange,
}: SakinaLibraryScreenProps) {
  const scholars = useMemo(() => getPublishedScholars(), []);
  const [view, setView] = useState<LibraryView>("library");
  const [selectedScholarId, setSelectedScholarId] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [savedLessonIds, setSavedLessonIds] = useState<Set<string>>(() => readStringSet(SAVED_LESSONS_KEY));
  const [progress, setProgress] = useState<Record<string, number>>(() => readProgress());

  useEffect(() => {
    onHideNavChange?.(view !== "library");
    return () => onHideNavChange?.(false);
  }, [onHideNavChange, view]);

  const selectedScholar = useMemo(
    () => scholars.find((scholar) => scholar.id === selectedScholarId) ?? null,
    [scholars, selectedScholarId],
  );

  const selectedSeries = useMemo(
    () => selectedScholar?.series.find((series) => series.id === selectedSeriesId) ?? null,
    [selectedScholar, selectedSeriesId],
  );

  const selectedLesson = useMemo(
    () => selectedSeries?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [selectedSeries, selectedLessonId],
  );

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return [] as Array<{ kind: "scholar" | "series" | "lesson"; scholar: SakinaScholar; series?: SakinaLessonSeries; lesson?: SakinaLessonItem }>;
    const results: Array<{ kind: "scholar" | "series" | "lesson"; scholar: SakinaScholar; series?: SakinaLessonSeries; lesson?: SakinaLessonItem }> = [];
    for (const scholar of scholars) {
      if (scholar.displayName.toLocaleLowerCase("ar").includes(normalized) || scholar.nameAr.toLocaleLowerCase("ar").includes(normalized)) {
        results.push({ kind: "scholar", scholar });
      }
      for (const series of scholar.series) {
        if (series.titleAr.toLocaleLowerCase("ar").includes(normalized)) {
          results.push({ kind: "series", scholar, series });
        }
        for (const lesson of series.lessons) {
          if (lesson.titleAr.toLocaleLowerCase("ar").includes(normalized)) {
            results.push({ kind: "lesson", scholar, series, lesson });
          }
        }
      }
    }
    return results.slice(0, 12);
  }, [query, scholars]);

  const savedLessons = useMemo(() => {
    const lessons: Array<{ scholar: SakinaScholar; series: SakinaLessonSeries; lesson: SakinaLessonItem }> = [];
    for (const scholar of scholars) {
      for (const series of scholar.series) {
        for (const lesson of series.lessons) {
          if (savedLessonIds.has(lesson.id)) lessons.push({ scholar, series, lesson });
        }
      }
    }
    return lessons;
  }, [savedLessonIds, scholars]);

  const openScholar = (scholar: SakinaScholar) => {
    setSelectedScholarId(scholar.id);
    setSelectedSeriesId(null);
    setSelectedLessonId(null);
    setView("scholar");
  };

  const openSeries = (scholar: SakinaScholar, series: SakinaLessonSeries) => {
    setSelectedScholarId(scholar.id);
    setSelectedSeriesId(series.id);
    setSelectedLessonId(null);
    setView("series");
  };

  const openLesson = (scholar: SakinaScholar, series: SakinaLessonSeries, lesson: SakinaLessonItem) => {
    setSelectedScholarId(scholar.id);
    setSelectedSeriesId(series.id);
    setSelectedLessonId(lesson.id);
    setView("lesson");
  };

  const goHome = () => {
    setView("library");
    setSelectedScholarId(null);
    setSelectedSeriesId(null);
    setSelectedLessonId(null);
  };

  const toggleSaved = (lessonId: string) => {
    setSavedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      try {
        localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify([...next]));
      } catch {
        // Local storage can be unavailable in private browsing; the in-memory state still works.
      }
      return next;
    });
  };

  const markLessonStarted = (lessonId: string) => {
    setProgress((current) => {
      if (current[lessonId] && current[lessonId] > 0) return current;
      const next = { ...current, [lessonId]: 1 };
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Keep progress in memory when storage is unavailable.
      }
      return next;
    });
  };

  const markLessonCompleted = (lessonId: string) => {
    setProgress((current) => {
      const next = { ...current, [lessonId]: 100 };
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Keep progress in memory when storage is unavailable.
      }
      return next;
    });
  };

  const title = view === "scholar" && selectedScholar
    ? selectedScholar.displayName
    : view === "series" && selectedSeries
      ? selectedSeries.titleAr
      : view === "lesson" && selectedLesson
        ? selectedLesson.titleAr
        : view === "saved"
          ? "محفوظاتي"
          : "مكتبة سكينة";

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#ece7de] text-[#2b1a10]">
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {view !== "library" ? (
            <button
              type="button"
              onClick={() => view === "lesson" ? setView("series") : view === "series" ? setView("scholar") : goHome()}
              className="flex h-10 w-10 items-center justify-center cut-crystal-capsule text-[#2b1a10] shadow-sm active:scale-95 transition-transform"
              aria-label="العودة"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center cut-crystal-capsule text-[#2b1a10] shadow-sm active:scale-95 transition-transform"
              aria-label="الخروج من مكتبة سكينة"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
          <div className="flex h-10 items-center justify-center cut-crystal-capsule px-4 shadow-sm">
            <span className="max-w-[48vw] truncate text-[13px] font-bold">{title}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("saved")}
            className={`flex h-10 items-center gap-1.5 cut-crystal-capsule px-3 text-xs font-bold shadow-sm active:scale-95 transition-transform ${view === "saved" ? "text-[#b88a4f]" : "text-[#2b1a10]"}`}
            aria-label="المحفوظات"
          >
            <BookmarkCheck className="h-4 w-4" />
            <span className="hidden sm:inline">محفوظاتي</span>
            {savedLessons.length > 0 && <span className="rounded-full bg-[#deab65] px-1.5 py-0.5 text-[10px] text-[#2b1a10]">{savedLessons.length}</span>}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-24 sm:px-6">
        <AnimatePresence mode="wait">
          {view === "library" && (
            <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <section className="cut-crystal-panel relative overflow-hidden rounded-[30px] p-6 sm:p-8">
                <div className="relative z-10 max-w-2xl">
                  <div className="mb-3 flex items-center gap-2 text-[#b88a4f]">
                    <GraduationCap className="h-5 w-5" />
                    <span className="text-xs font-black tracking-wide">محتوى علمي منتقى</span>
                  </div>
                  <h1 className="text-[26px] font-black leading-tight sm:text-[32px]">تعلم بهدوء، من مصادر موثوقة</h1>
                  <p className="mt-3 max-w-xl text-sm font-bold leading-7 text-[#7f6a55]">دروس ومحاضرات مرتبة داخل مكتبة سكينة، من الشيخ إلى السلسلة ثم الدرس، بلا تشتت ولا نتائج عشوائية.</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-[#7f6a55]">
                    <span className="cut-crystal-capsule px-3 py-2">ترشيح ومراجعة</span>
                    <span className="cut-crystal-capsule px-3 py-2">متابعة من حيث توقفت</span>
                    <span className="cut-crystal-capsule px-3 py-2">مشغل رسمي</span>
                  </div>
                </div>
                <Sparkles className="absolute -bottom-8 -left-4 h-40 w-40 text-[#b88a4f]/10" />
              </section>

              <form onSubmit={(event) => event.preventDefault()} className="cut-crystal-input flex items-center gap-3 px-4 py-3">
                <Search className="h-5 w-5 shrink-0 text-[#b88a4f]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن شيخ أو سلسلة أو درس..." className="w-full bg-transparent text-sm font-bold text-[#2b1a10] outline-none placeholder:text-[#7f6a55]/60" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X className="h-4 w-4 text-[#7f6a55]" /></button>}
              </form>

              {query && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1"><h2 className="text-sm font-black">نتائج البحث</h2><span className="text-xs font-bold text-[#7f6a55]">{searchResults.length} نتيجة</span></div>
                  {searchResults.length > 0 ? searchResults.map((result, index) => (
                    <button key={`${result.kind}-${result.lesson?.id ?? result.series?.id ?? result.scholar.id}-${index}`} type="button" onClick={() => result.kind === "scholar" ? openScholar(result.scholar) : result.kind === "series" && result.series ? openSeries(result.scholar, result.series) : result.series && result.lesson ? openLesson(result.scholar, result.series, result.lesson) : undefined} className="flex w-full items-center justify-between rounded-[22px] cut-crystal-panel px-4 py-3 text-right shadow-sm active:scale-[0.99] transition-transform">
                      <span><span className="block text-sm font-black">{result.lesson?.titleAr ?? result.series?.titleAr ?? result.scholar.displayName}</span><span className="mt-1 block text-xs font-bold text-[#7f6a55]">{result.lesson ? `${result.scholar.displayName} · ${result.series?.titleAr}` : result.kind === "series" ? result.scholar.displayName : "بورتفوليو الشيخ"}</span></span>
                      <ChevronLeft className="h-4 w-4 text-[#b88a4f]" />
                    </button>
                  )) : <EmptyState compact title="لا توجد نتائج في الكتالوج المنشور" description="البحث يعمل داخل المصادر التي تم اعتمادها ونشرها فقط." />}
                </section>
              )}

              {!query && scholars.length === 0 && (
                <EmptyState title="المكتبة قيد التجهيز" description="تم تجهيز البنية والبورتفوليو والمشغل والحفظ. ستظهر هنا الشيوخ والسلاسل بعد اعتماد القنوات والدروس الموثوقة." />
              )}

              {!query && scholars.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1"><h2 className="text-base font-black">الشيوخ المعتمدون</h2><span className="text-xs font-bold text-[#7f6a55]">{scholars.length} شيوخ</span></div>
                  <div className="grid gap-3 sm:grid-cols-2">{scholars.map((scholar) => <ScholarCard key={scholar.id} scholar={scholar} onClick={() => openScholar(scholar)} />)}</div>
                </section>
              )}
            </motion.div>
          )}

          {view === "saved" && (
            <motion.div key="saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              {savedLessons.length === 0 ? <EmptyState title="لا توجد دروس محفوظة" description="عند حفظ أول درس سيظهر هنا، مع نسبة التقدم وآخر موضع وصلت إليه." /> : savedLessons.map(({ scholar, series, lesson }) => <LessonRow key={lesson.id} lesson={lesson} progress={progress[lesson.id] ?? 0} saved onToggleSaved={() => toggleSaved(lesson.id)} onClick={() => openLesson(scholar, series, lesson)} />)}
            </motion.div>
          )}

          {view === "scholar" && selectedScholar && (
            <motion.div key="scholar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <section className="relative isolate min-h-[350px] overflow-hidden rounded-[30px] bg-[#2b1a10] text-[#fdfcfb] shadow-[0_18px_48px_rgba(43,26,16,0.16)] sm:min-h-[410px]">
                {selectedScholar.photoUrl ? <img src={selectedScholar.photoUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" loading="eager" decoding="async" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#deab65] to-[#2b1a10]" aria-hidden="true" />}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(222,171,101,0.18),transparent_42%),linear-gradient(180deg,rgba(43,26,16,0.08)_18%,rgba(43,26,16,0.18)_43%,rgba(43,26,16,0.97)_100%)]" aria-hidden="true" />
                <div className="absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-full border border-[#f2d19b]/25 bg-[#2b1a10]/35 px-3 py-2 text-xs font-black text-[#f7dfb4] backdrop-blur-md sm:bottom-7 sm:left-8" dir="rtl"><span>مصر</span><span aria-hidden="true">🇪🇬</span></div>
                <div className="relative z-10 flex min-h-[350px] flex-col justify-end px-5 pb-7 pt-16 text-center sm:min-h-[410px] sm:px-8 sm:pb-9">
                  <div className="mx-auto flex max-w-3xl flex-col items-center">
                    <h1 className="text-2xl font-black leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-3xl">{selectedScholar.displayName}</h1>
                    <p className="mt-3 max-w-2xl text-xs font-bold leading-6 text-[#fdfcfb]/75 drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]">{selectedScholar.bioShort ?? "دروس وسلاسل تعليمية مرتبة داخل مكتبة سكينة."}</p>
                  </div>
                </div>
              </section>
              {selectedScholar.sources && selectedScholar.sources.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-base font-black">مصادر الشيخ</h2>
                    <span className="text-xs font-bold text-[#7f6a55]">مصدران منفصلان</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedScholar.sources.map((source) => <ScholarSourceCard key={source.id} source={source} />)}
                  </div>
                </section>
              )}
              <section className="space-y-3"><h2 className="px-1 text-base font-black">السلاسل التعليمية</h2>{selectedScholar.series.length > 0 ? selectedScholar.series.map((series) => <SeriesCard key={series.id} series={series} onClick={() => openSeries(selectedScholar, series)} />) : <EmptyState compact title="لم تُنشر سلاسل لهذا الشيخ بعد" description="تم تجهيز مصادر القنوات أولًا. ستظهر السلاسل بعد مراجعة روابط دروسها واعتمادها." />}</section>
            </motion.div>
          )}

          {view === "series" && selectedScholar && selectedSeries && (
            <motion.div key="series" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <section className="cut-crystal-panel rounded-[30px] p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-black text-[#b88a4f]">{selectedScholar.displayName}</span><h1 className="mt-2 text-2xl font-black">{selectedSeries.titleAr}</h1><p className="mt-2 text-sm font-bold leading-7 text-[#7f6a55]">{selectedSeries.description ?? "سلسلة مرتبة لمتابعة الدروس خطوة بخطوة."}</p></div><ListVideo className="h-8 w-8 shrink-0 text-[#b88a4f]" /></div><div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[#7f6a55]"><span className="cut-crystal-capsule px-3 py-2">{selectedSeries.lessons.length} درس</span>{selectedSeries.category && <span className="cut-crystal-capsule px-3 py-2">{selectedSeries.category}</span>}</div></section>
              <section className="space-y-3">{selectedSeries.lessons.length > 0 ? selectedSeries.lessons.sort((a, b) => a.sortOrder - b.sortOrder).map((lesson) => <LessonRow key={lesson.id} lesson={lesson} progress={progress[lesson.id] ?? 0} saved={savedLessonIds.has(lesson.id)} onToggleSaved={() => toggleSaved(lesson.id)} onClick={() => openLesson(selectedScholar, selectedSeries, lesson)} />) : <EmptyState compact title="السلسلة قيد التجهيز" description="ستظهر الدروس بعد اعتماد روابطها الرسمية." />}</section>
            </motion.div>
          )}

          {view === "lesson" && selectedScholar && selectedSeries && selectedLesson && (
            <motion.div key="lesson" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <section className="cut-crystal-panel overflow-hidden rounded-[30px]">
                {selectedLesson.source?.videoId ? <div className="aspect-video w-full bg-[#2b1a10]"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(selectedLesson.source.videoId)}?enablejsapi=1&rel=0`} title={selectedLesson.titleAr} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen onLoad={() => markLessonStarted(selectedLesson.id)} /></div> : <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-[#2b1a10] px-6 text-center text-[#fdfcfb]"><Video className="h-10 w-10 text-[#deab65]" /><p className="text-sm font-bold">سيظهر المشغل الرسمي بعد اعتماد رابط الدرس</p></div>}
                <div className="space-y-3 p-5"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-black text-[#b88a4f]">{selectedScholar.displayName} · {selectedSeries.titleAr}</span><h1 className="mt-2 text-xl font-black">{selectedLesson.titleAr}</h1></div><button type="button" onClick={() => toggleSaved(selectedLesson.id)} className="flex h-10 w-10 shrink-0 items-center justify-center cut-crystal-capsule text-[#b88a4f]" aria-label={savedLessonIds.has(selectedLesson.id) ? "إلغاء الحفظ" : "حفظ الدرس"}>{savedLessonIds.has(selectedLesson.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</button></div><p className="text-sm font-bold leading-7 text-[#7f6a55]">{selectedLesson.descriptionShort ?? "درس منتقى داخل سلسلة تعليمية موثوقة."}</p><div className="flex flex-wrap gap-2 text-xs font-bold text-[#7f6a55]"><span className="cut-crystal-capsule flex items-center gap-1.5 px-3 py-2"><Clock3 className="h-3.5 w-3.5 text-[#b88a4f]" />{formatDuration(selectedLesson.durationSeconds)}</span>{selectedLesson.episodeNumber && <span className="cut-crystal-capsule px-3 py-2">الدرس {selectedLesson.episodeNumber}</span>}<span className="cut-crystal-capsule px-3 py-2">التقدم {progress[selectedLesson.id] ?? 0}%</span></div><div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={() => markLessonCompleted(selectedLesson.id)} className="cut-crystal-capsule-gold flex items-center gap-2 px-4 py-2.5 text-xs font-black"><CheckCircle2 className="h-4 w-4" />تمت المشاهدة</button>{selectedLesson.source?.canonicalUrl && <a href={selectedLesson.source.canonicalUrl} target="_blank" rel="noreferrer" className="cut-crystal-capsule flex items-center gap-2 px-4 py-2.5 text-xs font-black"><ArrowLeft className="h-4 w-4" />فتح في YouTube</a>}</div></div>
              </section>
              <div className="flex items-center justify-between px-1 text-xs font-bold text-[#7f6a55]"><span>السلسلة: {selectedSeries.titleAr}</span><button type="button" onClick={() => setView("series")} className="flex items-center gap-1 text-[#b88a4f]">كل الدروس <ChevronLeft className="h-4 w-4" /></button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <section className={`cut-crystal-panel rounded-[28px] text-center ${compact ? "p-5" : "p-8 sm:p-12"}`}><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#deab65]/15 text-[#b88a4f]"><LibraryBig className="h-7 w-7" /></div><h2 className="text-lg font-black">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-7 text-[#7f6a55]">{description}</p></section>;
}

function AvatarImage({ src, alt, fallback, large = false }: { src?: string; alt: string; fallback: string; large?: boolean }) {
  const sizeClass = large ? "h-full w-full rounded-[28px] text-3xl" : "h-14 w-14 rounded-full text-xl";
  return src ? <img src={src} alt={alt} className={`${sizeClass} shrink-0 border border-[#deab65]/50 object-cover shadow-sm`} loading="eager" decoding="async" /> : <div className={`${sizeClass} flex shrink-0 items-center justify-center bg-gradient-to-br from-[#deab65] to-[#b88a4f] font-black text-white shadow-sm`}>{fallback}</div>;
}

function ScholarCard({ scholar, onClick }: { scholar: SakinaScholar; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex w-full items-center justify-between gap-4 rounded-[26px] cut-crystal-panel p-4 text-right shadow-sm active:scale-[0.985] transition-transform"><div className="flex min-w-0 items-center gap-3"><AvatarImage src={scholar.photoUrl} alt={scholar.displayName} fallback={scholar.displayName.charAt(0)} /><div className="min-w-0"><h3 className="truncate text-base font-black group-hover:text-[#b88a4f]">{scholar.displayName}</h3><p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#7f6a55]"><ShieldCheck className="h-3.5 w-3.5 text-[#b88a4f]" />{verifiedLabel(scholar.verificationStatus)} · {scholar.series.length} سلسلة</p></div></div><ChevronLeft className="h-5 w-5 shrink-0 text-[#b88a4f]" /></button>;
}

function ScholarSourceCard({ source }: { source: NonNullable<SakinaScholar["sources"]>[number] }) {
  const isScientific = source.id === "amgad-samir-scientific-youtube";
  return (
    <a
      href={source.channelUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex min-h-[154px] flex-col justify-between rounded-[26px] cut-crystal-panel p-5 text-right shadow-sm transition-transform active:scale-[0.985]"
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-black text-[#b88a4f]"><Video className="h-4 w-4" />{source.labelAr}</span>
          <ExternalLink className="h-4 w-4 text-[#b88a4f] transition-transform group-hover:-translate-x-0.5" />
        </div>
        <h3 className="text-base font-black leading-7">{source.channelTitle}</h3>
        <p className="mt-2 text-xs font-bold leading-6 text-[#7f6a55]">{source.descriptionAr}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-black text-[#7f6a55]">
        <span className="cut-crystal-capsule px-3 py-1.5">{isScientific ? "سلاسل علمية طويلة" : "محتوى عام"}</span>
        <span className="text-[#b88a4f]">فتح القناة</span>
      </div>
    </a>
  );
}

function SeriesCard({ series, onClick }: { series: SakinaLessonSeries; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 rounded-[26px] cut-crystal-panel p-5 text-right shadow-sm active:scale-[0.985] transition-transform"><div><div className="mb-2 flex items-center gap-2 text-xs font-black text-[#b88a4f]"><ListVideo className="h-4 w-4" />سلسلة تعليمية</div><h3 className="text-lg font-black">{series.titleAr}</h3><p className="mt-1 text-sm font-bold leading-6 text-[#7f6a55]">{series.description ?? "سلسلة مرتبة داخل مكتبة سكينة."}</p><span className="mt-3 inline-flex cut-crystal-capsule px-3 py-1.5 text-xs font-bold text-[#7f6a55]">{series.lessons.length} درس</span></div><ChevronLeft className="h-5 w-5 shrink-0 text-[#b88a4f]" /></button>;
}

function LessonRow({ lesson, progress, saved, onToggleSaved, onClick }: { lesson: SakinaLessonItem; progress: number; saved: boolean; onToggleSaved: () => void; onClick: () => void }) {
  return <div className="flex items-center gap-3 rounded-[24px] cut-crystal-panel p-3 shadow-sm"><button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-right"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2b1a10] text-[#deab65]"><Play className="h-4 w-4 fill-current" /></div><div className="min-w-0"><h3 className="truncate text-sm font-black">{lesson.episodeNumber ? `${lesson.episodeNumber}. ` : ""}{lesson.titleAr}</h3><div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#7f6a55]"><span>{formatDuration(lesson.durationSeconds)}</span>{progress > 0 && <span className="text-[#b88a4f]">{progress >= 100 ? "مكتمل" : `${progress}%`}</span>}</div>{progress > 0 && <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-[#2b1a10]/10"><div className="h-full rounded-full bg-[#b88a4f]" style={{ width: `${Math.min(100, progress)}%` }} /></div>}</div></button><button type="button" onClick={onToggleSaved} className="flex h-9 w-9 shrink-0 items-center justify-center cut-crystal-capsule text-[#b88a4f]" aria-label={saved ? "إلغاء حفظ الدرس" : "حفظ الدرس"}>{saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</button></div>;
}
