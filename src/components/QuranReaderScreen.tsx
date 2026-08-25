import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Play, Pause, BookOpen, Download, Settings, Image as ImageIcon, ChevronRight, Copy, Bookmark, Palette
} from "lucide-react";
import { surahNames } from "@/data/surahNames";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { QuranOfflineService } from "@/services/QuranOfflineService";
import { MushafQcfV2LayoutService } from "@/services/MushafQcfV2LayoutService";
import { getMushafNavigationTarget } from "@/services/MushafSpreadPlanner";
import { useQcfFont, prefetchQcfFont } from "@/hooks/useQcfFont";
import { useMushafSpreadLayout } from "@/hooks/useMushafSpreadLayout";
import MushafSpreadSurface from "@/components/MushafSpreadSurface";
import MushafSpreadControlRail from "@/components/MushafSpreadControlRail";
import type { MushafQcfV2Page, MushafQcfV2Word } from "@/services/MushafQcfV2LayoutService";

const SURAH_START_PAGES: Record<number, number> = {"1":1,"2":2,"3":50,"4":77,"5":106,"6":128,"7":151,"8":177,"9":187,"10":208,"11":221,"12":235,"13":249,"14":255,"15":262,"16":267,"17":282,"18":293,"19":305,"20":312,"21":322,"22":332,"23":342,"24":350,"25":359,"26":367,"27":377,"28":385,"29":396,"30":404,"31":411,"32":415,"33":418,"34":428,"35":434,"36":440,"37":446,"38":453,"39":458,"40":467,"41":477,"42":483,"43":489,"44":496,"45":499,"46":502,"47":507,"48":511,"49":515,"50":518,"51":520,"52":523,"53":526,"54":528,"55":531,"56":534,"57":537,"58":542,"59":545,"60":549,"61":551,"62":553,"63":554,"64":556,"65":558,"66":560,"67":562,"68":564,"69":566,"70":568,"71":570,"72":572,"73":574,"74":575,"75":577,"76":578,"77":580,"78":582,"79":583,"80":585,"81":586,"82":587,"83":587,"84":589,"85":590,"86":591,"87":591,"88":592,"89":593,"90":594,"91":595,"92":595,"93":596,"94":596,"95":597,"96":597,"97":598,"98":598,"99":599,"100":599,"101":600,"102":600,"103":601,"104":601,"105":601,"106":602,"107":602,"108":602,"109":603,"110":603,"111":603,"112":604,"113":604,"114":604};


const toArabicDigits = (num: number | string) => {
  const id = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return num.toString().replace(/[0-9]/g, (w) => id[+w]);
};

function cleanTafsirText(value: string): string {
  if (typeof document === 'undefined') {
    return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
  const container = document.createElement('div');
  container.innerHTML = value;
  return (container.textContent || container.innerText || '').replace(/\s+/g, ' ').trim();
}

function tafsirSourceUrl(verseKey: string): string {
  return `https://quran.com/${verseKey.replace(':', '/')}/tafsirs/ar-tafsir-ibn-kathir`;
}

interface ThemeOption {
  id: "papyrus" | "scroll" | "twilight" | "olive";
  name: string;
  bg: string;
  text: string;
  cardBg: string;
  border: string;
  accent: string;
  highlight: string;
  accentHex: string;
  highlightBgHex: string;
  playingBgHex: string;
  hoverBgHex: string;
  accentLightHex: string;
}

const THEMES: Record<string, ThemeOption> = {
  papyrus: {
    id: "papyrus",
    name: "القرطاس الدافئ",
    bg: "bg-[#f7f2ea]",
    text: "text-[#2b1a10]",
    cardBg: "bg-[#fdfcfb]",
    border: "border-[#e6dccf]",
    accent: "text-[#b88a4f]",
    highlight: "bg-[#b88a4f]/10",
    accentHex: "#b88a4f",
    highlightBgHex: "rgba(184, 138, 79, 0.18)",
    playingBgHex: "rgba(184, 138, 79, 0.28)",
    hoverBgHex: "rgba(184, 138, 79, 0.10)",
    accentLightHex: "#d9b877",
  },
  scroll: {
    id: "scroll",
    name: "السجل الأبيض",
    bg: "bg-[#fafafa]",
    text: "text-[#1c1917]",
    cardBg: "bg-[#ffffff]",
    border: "border-[#e7e5e4]",
    accent: "text-[#78716c]",
    highlight: "bg-[#78716c]/8",
    accentHex: "#78716c",
    highlightBgHex: "rgba(120, 113, 108, 0.16)",
    playingBgHex: "rgba(120, 113, 108, 0.26)",
    hoverBgHex: "rgba(120, 113, 108, 0.10)",
    accentLightHex: "#a8a29e",
  },
  twilight: {
    id: "twilight",
    name: "الغسق الهادئ",
    bg: "bg-[#181412]",
    text: "text-[#ece7de]",
    cardBg: "bg-[#251e1a]",
    border: "border-[#3a3029]",
    accent: "text-[#deab65]",
    highlight: "bg-[#deab65]/15",
    accentHex: "#deab65",
    highlightBgHex: "rgba(222, 171, 101, 0.18)",
    playingBgHex: "rgba(222, 171, 101, 0.30)",
    hoverBgHex: "rgba(222, 171, 101, 0.12)",
    accentLightHex: "#8a6a3d",
  },
  olive: {
    id: "olive",
    name: "الزيتوني العتيق",
    bg: "bg-[#edf1eb]",
    text: "text-[#1d271a]",
    cardBg: "bg-[#f5f7f3]",
    border: "border-[#dae2d7]",
    accent: "text-[#4d6342]",
    highlight: "bg-[#4d6342]/10",
    accentHex: "#4d6342",
    highlightBgHex: "rgba(77, 99, 66, 0.18)",
    playingBgHex: "rgba(77, 99, 66, 0.28)",
    hoverBgHex: "rgba(77, 99, 66, 0.10)",
    accentLightHex: "#7d946e",
  }
};

const MOCK_RECITERS = [
  { id: 1, name: "مشاري راشد العفاسي" },
  { id: 2, name: "عبد الباسط عبد الصمد" },
  { id: 3, name: "محمود خليل الحصري" },
  { id: 4, name: "ياسر الدوسري" },
];

interface Props {
  surahId: number;
  onClose: () => void;
  onPlayAudio?: (surahId: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  initialPage?: number;
}

type SelectedVerseInfo = {
  verse_key: string;
  text_uthmani: string;
  chapter_id: number;
  verse_number: number;
  page: number;
};

export default function QuranReaderScreen({
  surahId,
  onClose,
  onPlayAudio,
  isPlaying: externalIsPlaying,
  onTogglePlay,
  initialPage
}: Props) {
  const [currentPage, setCurrentPage] = useState<number>(initialPage || SURAH_START_PAGES[surahId] || 1);
  const [animationDirection, setAnimationDirection] = useState<"next" | "prev">("next");

  // Keep the page canvas on the compositor. A small directional translation
  // plus opacity is deliberately used instead of clip-path, which can trigger
  // repeated rasterization when several QCF pages are turned in succession.
  const pageVariants = {
    initial: (direction: "next" | "prev") => ({
      opacity: 0,
      x: direction === "next" ? 10 : -10,
    }),
    animate: { opacity: 1, x: 0 },
    exit: (direction: "next" | "prev") => ({
      opacity: 0,
      x: direction === "next" ? -10 : 10,
    }),
  };

  const pageTransition = {
    duration: 0.16,
    ease: [0.23, 1, 0.32, 1] as const,
  };
  const [pageData, setPageData] = useState<MushafQcfV2Page | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Controls & Modals
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showActionCard, setShowActionCard] = useState(false);
  const [selectedVerseForAction, setSelectedVerseForAction] = useState<SelectedVerseInfo | null>(null);

  const [highlightedVerseKey, setHighlightedVerseKey] = useState<string | null>(null);

  const [showTafsir, setShowTafsir] = useState(false);
  const [tafsirContent, setTafsirContent] = useState<{
    text: string;
    verseKey: string;
    isOffline: boolean;
    sourceName: string;
    sourceUrl: string;
  } | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirDownloading, setTafsirDownloading] = useState(false);
  const [tafsirDownloadPercent, setTafsirDownloadPercent] = useState(0);
  const [tafsirDownloadMessage, setTafsirDownloadMessage] = useState<string | null>(null);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'single' | 'page' | 'continuous'>('continuous');
  const isNotContinuousMode = playMode !== 'continuous';
  const [repeatSettings, setRepeatSettings] = useState({ count: 1, current: 0 });
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [selectedReciter, setSelectedReciter] = useState<number>(1);

  const [reflectionVerse, setReflectionVerse] = useState<any>(null);

  // Bookmarking State
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkedVerses, setBookmarkedVerses] = useState<string[]>([]);

  // Theme
  const [themeId, setThemeId] = useState<"papyrus" | "scroll" | "twilight" | "olive">(() => {
    try {
      const saved = localStorage.getItem("sakina_reader_theme") as any;
      return saved && THEMES[saved] ? saved : "papyrus";
    } catch {
      return "papyrus";
    }
  });

  const activeTheme = THEMES[themeId];

  const currentSurahId = useMemo(() => {
    if (pageData && pageData.lines) {
      for (const line of pageData.lines) {
        if (line.type === 'surah-header' && line.surah) {
          return parseInt(line.surah, 10);
        }
        if (line.type === 'text' && line.verseRange) {
          const chap = parseInt(line.verseRange.split(':')[0], 10);
          if (!isNaN(chap)) return chap;
        }
      }
    }
    return surahId;
  }, [pageData, surahId]);

  useEffect(() => {
    try {
      const bookmarks = JSON.parse(localStorage.getItem("sakina_quran_bookmarks") || "[]");
      const pageBookmarked = bookmarks.some((b: any) => b.type === "page" && b.page === currentPage);
      setIsBookmarked(pageBookmarked);
      const verses = bookmarks.filter((b: any) => b.type === "verse").map((b: any) => b.verseKey);
      setBookmarkedVerses(verses);
    } catch (e) {
      console.error(e);
    }
  }, [currentPage]);

  const togglePageBookmark = () => {
    try {
      const bookmarks = JSON.parse(localStorage.getItem("sakina_quran_bookmarks") || "[]");
      const isExist = bookmarks.some((b: any) => b.type === "page" && b.page === currentPage);
      let updated = [];
      if (isExist) {
        updated = bookmarks.filter((b: any) => !(b.type === "page" && b.page === currentPage));
        setIsBookmarked(false);
      } else {
        const newBookmark = {
          id: `page-${currentPage}`,
          type: "page",
          surahId: currentSurahId,
          surahName: surahNames[currentSurahId] || `سورة ${currentSurahId}`,
          page: currentPage,
          timestamp: Date.now()
        };
        updated = [newBookmark, ...bookmarks];
        setIsBookmarked(true);
      }
      localStorage.setItem("sakina_quran_bookmarks", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVerseBookmark = (verse: SelectedVerseInfo) => {
    try {
      const bookmarks = JSON.parse(localStorage.getItem("sakina_quran_bookmarks") || "[]");
      const isExist = bookmarks.some((b: any) => b.type === "verse" && b.verseKey === verse.verse_key);
      let updated = [];
      if (isExist) {
        updated = bookmarks.filter((b: any) => !(b.type === "verse" && b.verseKey === verse.verse_key));
        setBookmarkedVerses(prev => prev.filter(k => k !== verse.verse_key));
      } else {
        const newBookmark = {
          id: `verse-${verse.verse_key}`,
          type: "verse",
          surahId: verse.chapter_id,
          surahName: surahNames[verse.chapter_id] || `سورة ${verse.chapter_id}`,
          verseNumber: verse.verse_number,
          verseKey: verse.verse_key,
          page: verse.page,
          timestamp: Date.now()
        };
        updated = [newBookmark, ...bookmarks];
        setBookmarkedVerses(prev => [...prev, verse.verse_key]);
      }
      localStorage.setItem("sakina_quran_bookmarks", JSON.stringify(updated));
      setShowActionCard(false);
    } catch (e) {
      console.error(e);
    }
  };
  const startPage = SURAH_START_PAGES[currentSurahId] || 1;
  const endPage = currentSurahId < 114 ? (SURAH_START_PAGES[currentSurahId + 1] - 1) : 604;
  const totalPages = endPage - startPage + 1;

  useEffect(() => {
    try { localStorage.setItem("sakina_reader_theme", themeId); } catch {}
  }, [themeId]);

  // Load page data for the current page
  useEffect(() => {
    let isMounted = true;

    const fetchPageData = async () => {
      setIsLoading(true);
      setPageData(null);
      setHighlightedVerseKey(null);

      try {
        const page = await MushafQcfV2LayoutService.getPage(currentPage);
        if (!isMounted) return;
        setPageData(page);
      } catch (err: any) {
        console.error("Error loading offline Quran Page:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPageData();
    return () => { isMounted = false; };
  }, [currentPage]);

  // QCF font loading for current page + prefetch adjacent pages
  const isFontLoaded = useQcfFont(currentPage);

  useEffect(() => {
    if (currentPage < 604) {
      prefetchQcfFont(currentPage + 1);
      MushafQcfV2LayoutService.prefetchPage(currentPage + 1);
    }
    if (currentPage > 1) {
      prefetchQcfFont(currentPage - 1);
      MushafQcfV2LayoutService.prefetchPage(currentPage - 1);
    }
    // Always ensure QCF_P001 is loaded — basmala glyphs (0xfc41-0xfc45) are only
    // properly defined in QCF_P001 (page 1 / Al-Fatiha), not in other page fonts
    prefetchQcfFont(1);
  }, [currentPage]);

  // The layout hook measures the real safe reader rectangle and returns either
  // a one-page plan or a fully-contained fixed-page spread plan.
  const { setViewportRef, plan: mushafPlan, controlLayout } = useMushafSpreadLayout(currentPage, {
    layoutVersion: `${showControls}:${isPlaying}:${playMode}:${showActionCard}:${showReciterModal}`,
  });

  // Directional swipe logic: in the Arabic reading flow, dragging from the
  // right edge toward the left goes to the previous page, while dragging from
  // the left edge toward the right goes to the next page.
  const swipeRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    lastX: 0,
    tracking: false,
    horizontal: false,
  });
  const suppressClickRef = useRef(false);
  const navigationLockRef = useRef(false);
  const navigationUnlockTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (navigationUnlockTimerRef.current !== null) {
      window.clearTimeout(navigationUnlockTimerRef.current);
    }
  }, []);

  const navigateMushaf = (direction: "next" | "previous") => {
    if (navigationLockRef.current) return;
    const targetPage = getMushafNavigationTarget(mushafPlan, direction, currentPage);
    if (targetPage === currentPage) return;
    navigationLockRef.current = true;
    setAnimationDirection(direction === "next" ? "next" : "prev");
    setCurrentPage(targetPage);
    navigationUnlockTimerRef.current = window.setTimeout(() => {
      navigationLockRef.current = false;
      navigationUnlockTimerRef.current = null;
    }, 190);
  };

  const onReaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button']")) return;
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      tracking: true,
      horizontal: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onReaderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe.tracking || swipe.pointerId !== event.pointerId) return;
    swipe.lastX = event.clientX;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (!swipe.horizontal && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      swipe.horizontal = true;
    }
    if (swipe.horizontal) event.preventDefault();
  };

  const finishReaderSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe.tracking || swipe.pointerId !== event.pointerId) return;
    const deltaX = swipe.lastX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const wasSwipe = swipe.horizontal && Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    swipeRef.current.tracking = false;
    if (wasSwipe) {
      suppressClickRef.current = true;
      // A rightward drag begins at the left edge and advances in the Arabic flow.
      navigateMushaf(deltaX > 0 ? "next" : "previous");
    }
  };

  const cancelReaderSwipe = () => {
    swipeRef.current.tracking = false;
    swipeRef.current.horizontal = false;
  };

  // Verse interaction (long press -> action card)
  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  const extractVerseKeyFromWord = (word: MushafQcfV2Word): string | null => {
    if (!word.location) return null;
    const parts = word.location.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return null;
  };

  const handleWordLongPressStart = (
    pageNumber: number,
    word: MushafQcfV2Word,
    lineText: string,
    e: React.TouchEvent | React.MouseEvent,
  ) => {
    e.stopPropagation();
    const verseKey = extractVerseKeyFromWord(word);
    if (!verseKey) return;
    const parts = word.location.split(':');
    const verse: SelectedVerseInfo = {
      verse_key: verseKey,
      text_uthmani: lineText || word.word,
      chapter_id: parseInt(parts[0], 10),
      verse_number: parseInt(parts[1], 10),
      page: pageNumber,
    };

    touchTimer.current = setTimeout(() => {
      setSelectedVerseForAction(verse);
      setShowActionCard(true);
    }, 500);
  };

  const handleWordLongPressEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  const handleWordClick = (word: MushafQcfV2Word, e: React.MouseEvent) => {
    e.stopPropagation();
    handleWordLongPressEnd();
    const verseKey = extractVerseKeyFromWord(word);
    if (!verseKey) return;
    // Check if this is the last word of a verse (contains Arabic number)
    const isEnd = word.charType === 'end' || /\d+$/.test(word.word) || /[\u0660-\u0669]$/.test(word.word);
    if (isEnd) {
      setPlayingVerseKey(verseKey);
      setIsPlaying(true);
    } else {
      setHighlightedVerseKey(prev => (prev === verseKey ? null : verseKey));
    }
  };

  // Actions
  const handleShowTafsirForSelected = async () => {
    if (!selectedVerseForAction) return;
    const selectedVerse = selectedVerseForAction;
    setShowActionCard(false);
    setShowTafsir(true);
    setTafsirContent(null);
    setTafsirDownloadMessage(null);
    setTafsirLoading(true);
    try {
      const tafsirPage = await QuranOfflineService.getTafsirPage(selectedVerse.page);
      const offlineEntry = tafsirPage?.find((entry) => entry.verse_key === selectedVerse.verse_key) ?? null;
      const verseTafsir = offlineEntry ?? await QuranOfflineService.getTafsirForAyah(selectedVerse.verse_key);
      if (!verseTafsir || verseTafsir.resource_id !== QuranOfflineService.tafsirResourceId || verseTafsir.verse_key !== selectedVerse.verse_key) {
        throw new Error('TAFSIR_VERSE_MISMATCH');
      }
      setTafsirContent({
        text: cleanTafsirText(verseTafsir.text),
        verseKey: verseTafsir.verse_key,
        isOffline: Boolean(offlineEntry),
        sourceName: QuranOfflineService.tafsirResourceName,
        sourceUrl: tafsirSourceUrl(verseTafsir.verse_key),
      });
    } catch (e) {
      console.error('Failed to load verified tafsir', e);
      setTafsirContent({
        text: 'تعذر جلب التفسير الموثوق لهذه الآية. حاول مرة أخرى عند توفر الاتصال.',
        verseKey: selectedVerse.verse_key,
        isOffline: false,
        sourceName: QuranOfflineService.tafsirResourceName,
        sourceUrl: tafsirSourceUrl(selectedVerse.verse_key),
      });
    } finally {
      setTafsirLoading(false);
    }
  };

  const handleDownloadTafsir = async () => {
    if (tafsirDownloading) return;
    setTafsirDownloading(true);
    setTafsirDownloadPercent(0);
    setTafsirDownloadMessage(null);
    try {
      await QuranOfflineService.downloadTafsir((percent, message) => {
        setTafsirDownloadPercent(percent);
        setTafsirDownloadMessage(message);
      });
      setTafsirDownloadPercent(100);
      setTafsirDownloadMessage('تم تنزيل تفسير ابن كثير كاملًا للعمل دون اتصال');
      if (selectedVerseForAction) {
        const cachedPage = await QuranOfflineService.getTafsirPage(selectedVerseForAction.page);
        const cachedEntry = cachedPage?.find((entry) => entry.verse_key === selectedVerseForAction.verse_key);
        if (cachedEntry) {
          setTafsirContent({
            text: cleanTafsirText(cachedEntry.text),
            verseKey: cachedEntry.verse_key,
            isOffline: true,
            sourceName: QuranOfflineService.tafsirResourceName,
            sourceUrl: tafsirSourceUrl(cachedEntry.verse_key),
          });
        }
      }
    } catch (e) {
      console.error('Failed to download verified tafsir', e);
      setTafsirDownloadMessage('تعذر تنزيل التفسير كاملًا. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setTafsirDownloading(false);
    }
  };

  const handlePlaySelectedVerse = () => {
    if (!selectedVerseForAction) return;
    setIsPlaying(true);
    setPlayingVerseKey(selectedVerseForAction.verse_key);
    setShowActionCard(false);
  };

  const handleCopyVerse = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowActionCard(false);
  };

  const handleShowReflectionCard = () => {
    setReflectionVerse(selectedVerseForAction);
    setShowActionCard(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const isPrimaryPageReady = !isLoading && pageData !== null && isFontLoaded;
  const isOpeningPage = currentPage === 1 || currentPage === 2;
  const isSideRailLayout = controlLayout?.mode === 'side-rail' && mushafPlan?.mode === 'spread';
  const stageStyle = controlLayout
    ? {
        left: `${controlLayout.stage.left}px`,
        top: `${controlLayout.stage.top}px`,
        width: `${controlLayout.stage.width}px`,
        height: `${controlLayout.stage.height}px`,
      }
    : { inset: 0 };
  const readerMotionKey = mushafPlan
    ? `${mushafPlan.mode}-${mushafPlan.anchorPage}`
    : `mushaf-measuring-${currentPage}`;

  return (
    <motion.div
      key="quran-reader-screen"
      initial={{ opacity: 0, filter: 'blur(5px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(5px)' }}
      transition={{ duration: 0.4 }}
      className={`fixed inset-0 w-full h-[100vh] overflow-hidden flex flex-col justify-center px-4 sm:px-8 font-sans transition-colors duration-500 ${activeTheme.bg} ${activeTheme.text}`}
      dir="rtl"
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        setShowControls(!showControls);
        setShowActionCard(false);
        setSelectedVerseForAction(null);
      }}
    >
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={(e) => {
          console.error("Audio playback error", e);
          setIsPlaying(false);
        }}
        className="hidden"
      />

      {/* Content Area */}
      <div className={`flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center overflow-hidden relative`}>
        {/* Integrated Header Info - Fixed Position */}
        <div className="absolute top-6 left-0 right-0 flex justify-between items-center px-8 font-bold text-[10px] sm:text-xs opacity-50 pointer-events-none font-sans">
          <span>الجُزْءُ {pageData && pageData.page ? '' : ''}</span>
          <span>
              {pageData ? `سُورَةُ ${surahNames[currentSurahId] || ''}` : ''}
          </span>
        </div>

        {/* Opening pages render their folios inside the fixed page canvas. The
            external reader number remains unchanged for every other page. */}
        {!isOpeningPage && (
          <div className="absolute bottom-6 left-8 flex justify-center items-center font-bold text-xs sm:text-sm opacity-80 pointer-events-none font-sans">
            {toArabicDigits(currentPage)}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={readerMotionKey}
            custom={animationDirection}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ willChange: "transform, opacity", touchAction: "pan-y" }}
            ref={setViewportRef}
            data-mushaf-control-layout={controlLayout?.mode ?? 'measuring'}
            className="qcf-page-viewport relative w-full h-full overflow-visible touch-pan-y"
            onPointerDown={onReaderPointerDown}
            onPointerMove={onReaderPointerMove}
            onPointerUp={finishReaderSwipe}
            onPointerCancel={cancelReaderSwipe}
            onLostPointerCapture={cancelReaderSwipe}
          >
            <div className="mushaf-spread-measure" style={stageStyle}>
              {!isPrimaryPageReady || !mushafPlan || !controlLayout ? (
                <div className="mushaf-spread-loader" role="status" aria-live="polite">
                  <SakeenahLineSpinner size={40} color={activeTheme.accent} label="جارٍ تحميل صفحة القرآن" />
                  <span className={`text-xs font-sans opacity-60 ${activeTheme.accent}`}>
                    {isLoading || !pageData
                      ? "جاري تحميل الصفحة..."
                      : !isFontLoaded
                        ? "جاري تحميل خط المصحف..."
                        : "جاري قياس مساحة العرض..."}
                  </span>
                </div>
              ) : (
                <MushafSpreadSurface
                  key={mushafPlan.key}
                  plan={mushafPlan}
                  activePageData={pageData}
                  theme={{
                    accent: activeTheme.accentHex,
                    highlight: activeTheme.highlightBgHex,
                    playing: activeTheme.playingBgHex,
                    hover: activeTheme.hoverBgHex,
                    accentLight: activeTheme.accentLightHex,
                  }}
                  loadingAccentClassName={activeTheme.accent}
                  highlightedVerseKey={highlightedVerseKey}
                  selectedVerseKey={selectedVerseForAction?.verse_key ?? null}
                  playingVerseKey={playingVerseKey}
                  onWordClick={handleWordClick}
                  onWordLongPressStart={handleWordLongPressStart}
                  onWordLongPressEnd={handleWordLongPressEnd}
                />
              )}
            </div>
            {isSideRailLayout && (
              <MushafSpreadControlRail
                layout={controlLayout}
                showControls={showControls}
                showActionCard={showActionCard}
                selectedVerse={selectedVerseForAction ? {
                  verseKey: selectedVerseForAction.verse_key,
                  text: selectedVerseForAction.text_uthmani,
                } : null}
                isPlaying={isPlaying}
                playMode={playMode}
                showReciterModal={showReciterModal}
                isVerseBookmarked={Boolean(selectedVerseForAction && bookmarkedVerses.includes(selectedVerseForAction.verse_key))}
                primaryTextClassName={activeTheme.text}
                onToggleSettings={() => setShowSettings(!showSettings)}
                onTogglePlay={togglePlayPause}
                onShowReciter={() => setShowReciterModal(true)}
                onToggleAudioSettings={() => setShowAudioSettings(!showAudioSettings)}
                onStopPlayer={() => {
                  audioRef.current?.pause();
                  setIsPlaying(false);
                  setPlayingVerseKey(null);
                }}
                onPlaySelected={handlePlaySelectedVerse}
                onShowTafsir={handleShowTafsirForSelected}
                onShowReflection={handleShowReflectionCard}
                onCopySelected={handleCopyVerse}
                onToggleVerseBookmark={() => {
                  if (selectedVerseForAction) toggleVerseBookmark(selectedVerseForAction);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Card for Selected Verse */}
      <AnimatePresence>
        {!isSideRailLayout && showActionCard && selectedVerseForAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="!fixed z-[60] cut-crystal-capsule flex items-center gap-1 px-2 py-1 !text-[#2b1a10] shadow-2xl"
            style={{
              bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
              left: '0.75rem',
              right: '0.75rem',
              width: 'fit-content',
              maxWidth: 'calc(100vw - 1.5rem)',
              marginInline: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            dir="ltr"
          >
            <button
              onClick={handlePlaySelectedVerse}
              className="h-8 w-8 p-0 rounded-full flex items-center justify-center text-[#b88a4f] transition-colors hover:text-[#deab65] active:scale-95"
              title="تلاوة"
            >
              <Play size={16} fill="currentColor" />
            </button>
            <div className="h-4 w-px border-l border-[#e6dccf]"></div>
            <button
              onClick={handleShowTafsirForSelected}
              className="h-8 w-8 p-0 rounded-full flex items-center justify-center text-[#2b1a10] transition-colors hover:text-[#b88a4f] active:scale-95"
              title="تفسير"
            >
              <BookOpen size={16} />
            </button>
            <div className="h-4 w-px border-l border-[#e6dccf]"></div>
            <button
              onClick={handleShowReflectionCard}
              className="h-8 w-8 p-0 rounded-full flex items-center justify-center text-[#2b1a10] transition-colors hover:text-[#b88a4f] active:scale-95"
              title="بطاقة تدبر"
            >
              <ImageIcon size={16} />
            </button>
            <div className="h-4 w-px border-l border-[#e6dccf]"></div>
            <button
              onClick={() => handleCopyVerse(selectedVerseForAction.text_uthmani)}
              className="h-8 w-8 p-0 rounded-full flex items-center justify-center text-[#2b1a10] transition-colors hover:text-[#b88a4f] active:scale-95"
              title="نسخ"
            >
              <Copy size={16} />
            </button>
            <div className="h-4 w-px border-l border-[#e6dccf]"></div>
            <button
              onClick={() => toggleVerseBookmark(selectedVerseForAction)}
              className={`h-8 w-8 p-0 rounded-full flex items-center justify-center transition-colors hover:text-[#b88a4f] active:scale-95 ${bookmarkedVerses.includes(selectedVerseForAction.verse_key) ? "text-[#b88a4f]" : "text-[#2b1a10]"}`}
              title="حفظ العلامة المرجعية"
            >
              <Bookmark size={16} fill={bookmarkedVerses.includes(selectedVerseForAction.verse_key) ? "currentColor" : "none"} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Player Sheet */}
      <AnimatePresence>
        {!isSideRailLayout && isPlaying && playMode === 'single' && !showReciterModal && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="!fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] cut-crystal-capsule px-4 py-2 flex items-center gap-4 !text-[#2b1a10] shadow-lg"
            onClick={(e) => e.stopPropagation()}
            dir="ltr"
          >
            {/* Reciter Button */}
            <button
              onClick={() => setShowReciterModal(true)}
              className="flex items-center gap-1.5 text-[#2b1a10] transition-colors hover:text-[#b88a4f]"
              title="القارئ"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>

            <div className={`w-px h-6 border-l ${activeTheme.border}`}></div>

            {/* Stop Button */}
            <button
              onClick={() => {
                audioRef.current?.pause();
                setIsPlaying(false);
                setPlayingVerseKey(null);
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 bg-red-500 hover:bg-red-600`}
            >
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </button>

            <div className={`w-px h-6 border-l ${activeTheme.border}`}></div>

            {/* Settings Button */}
            <button
              onClick={() => setShowAudioSettings(!showAudioSettings)}
              className={`flex items-center gap-1.5 transition-colors hover:opacity-70 ${isNotContinuousMode ? activeTheme.accent : activeTheme.text}`}
              title="إعدادات التكرار"
            >
              <div className="relative">
                <Settings size={22} />
                {isNotContinuousMode && (
                  <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold text-white w-4 h-4 rounded-full flex items-center justify-center border border-white ${activeTheme.accent.replace('text-', 'bg-')}`}>
                    {repeatSettings.count}
                  </span>
                )}
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Settings Modal */}
      <AnimatePresence>
        {showAudioSettings && isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="!fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] w-72 cut-crystal-panel rounded-[28px] p-5 text-[#2b1a10] font-sans"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm">إعدادات التكرار</h3>
              <button onClick={() => setShowAudioSettings(false)} className="p-1 hover:opacity-70 rounded-full">
                <X size={16} className="opacity-50" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Play Mode */}
              <div>
                <label className="text-xs font-bold mb-2 block opacity-70">نطاق التكرار</label>
                <div className={`flex rounded-xl p-1 gap-1 border ${activeTheme.border} bg-black/5`}>
                  <button
                    onClick={() => setPlayMode('single')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playMode === 'single' ? `bg-[#b88a4f] text-[#fff9f1] shadow-md` : 'hover:opacity-70 opacity-70'}`}
                  >
                    آية واحدة
                  </button>
                  <button
                    onClick={() => setPlayMode('page')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playMode === 'page' ? `bg-[#b88a4f] text-[#fff9f1] shadow-md` : 'hover:opacity-70 opacity-70'}`}
                  >
                    صفحة كاملة
                  </button>
                  <button
                    onClick={() => setPlayMode('continuous')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playMode === 'continuous' ? `bg-[#b88a4f] text-[#fff9f1] shadow-md` : 'hover:opacity-70 opacity-70'}`}
                  >
                    مستمر
                  </button>
                </div>
              </div>

              {/* Repeat Count */}
              {isNotContinuousMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex justify-between mb-2">
                      <label className="text-xs font-bold opacity-70">عدد التكرار</label>
                      <span className={`text-xs font-bold ${activeTheme.accent}`}>{repeatSettings.count === 10 ? '∞' : repeatSettings.count}</span>
                  </div>
                  <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={repeatSettings.count}
                      onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setRepeatSettings(prev => ({ ...prev, count: val }));
                      }}
                      className={`w-full ${activeTheme.accent.replace('text-', 'accent-')} h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer`}
                  />
                  <div className="flex justify-between text-[10px] opacity-40 mt-2 font-sans">
                      <span>1</span>
                      <span>3</span>
                      <span>5</span>
                      <span>∞</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Controls */}
      <AnimatePresence>
        {showControls && (
          <>
            {/* Exit Button */}
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="!absolute top-6 right-6 z-50 w-9 h-9 cut-crystal-capsule flex items-center justify-center text-[#2b1a10] shadow-md transition-all duration-200 hover:opacity-80 active:scale-95"
              aria-label="الخروج من المصحف"
            >
              <ChevronRight size={17} />
            </motion.button>

            {/* Page Bookmark Button */}
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
              onClick={(e) => { e.stopPropagation(); togglePageBookmark(); }}
              className={`!absolute top-6 left-6 z-50 w-9 h-9 cut-crystal-capsule flex items-center justify-center shadow-md transition-all duration-200 active:scale-95 ${isBookmarked ? "text-[#b88a4f]" : "text-[#2b1a10]"} hover:opacity-80`}
              title="حفظ الصفحة الحالية"
            >
              <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
            </motion.button>

            {/* Floating Control Card */}
            {!isSideRailLayout && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="!absolute bottom-8 left-1/2 -translate-x-1/2 z-50 cut-crystal-capsule flex items-center gap-1 px-2 py-1.5 shadow-lg !text-[#2b1a10]"
              onClick={(e) => e.stopPropagation()}
              dir="ltr"
            >
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#2b1a10] transition-all duration-200 hover:text-[#b88a4f] active:scale-95"
                title="السمات والألوان"
              >
                <Palette size={16} />
              </button>

              <button
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#b88a4f] text-[#fff9f1] shadow-md transition-all duration-200 hover:bg-[#a0753e] active:scale-95"
                onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              >
                {isPlaying && playMode === 'continuous' ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={() => setShowReciterModal(true)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#2b1a10] transition-all duration-200 hover:text-[#b88a4f] active:scale-95"
                title="القارئ"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </button>
            </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Reciter Modal */}
      <AnimatePresence>
        {showReciterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); setShowReciterModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm cut-crystal-panel rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[70vh] text-[#2b1a10]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-5 border-b text-center font-sans font-bold text-lg ${activeTheme.border}`}>
                اختر القارئ
              </div>
              <div className="overflow-y-auto custom-scrollbar p-2 flex-1">
                {MOCK_RECITERS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedReciter(r.id);
                      setShowReciterModal(false);
                    }}
                    className={`w-full text-right px-4 py-3 rounded-xl mb-1 transition-colors flex items-center justify-between font-sans ${selectedReciter === r.id ? `bg-[#b88a4f]/10 text-[#b88a4f]` : `hover:opacity-80`}`}
                  >
                    <span>{r.name}</span>
                    {selectedReciter === r.id && <div className={`w-2 h-2 rounded-full ${activeTheme.accent.replace('text-', 'bg-')}`}></div>}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal (Theme) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="!fixed bottom-[5.25rem] left-1/2 -translate-x-1/2 z-[80] cut-crystal-capsule px-2 py-1.5 text-[#2b1a10] font-sans"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-1.5" aria-label="اختيار مظهر المصحف">
              {Object.values(THEMES).map((t) => {
                const isSel = themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    aria-label={t.name}
                    title={t.name}
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
                      isSel ? `${activeTheme.accent} bg-black/5 ring-1 ring-current` : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full border ${t.bg} ${t.border} shadow-inner`} />
                  </button>
                );
              })}
              <button
                onClick={() => setShowSettings(false)}
                aria-label="إغلاق المظهر"
                className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[#2b1a10]/60 transition-all duration-200 hover:text-[#2b1a10] active:scale-90"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tafsir Modal */}
      <AnimatePresence>
        {showTafsir && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg h-[min(68vh,560px)] sm:h-auto sm:max-h-[80vh] cut-crystal-panel rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col pointer-events-auto text-[#2b1a10] font-sans">
              <div className={`flex justify-between items-center gap-3 px-4 py-3 border-b ${activeTheme.border}`}>
                <div className="min-w-0 text-right" dir="rtl">
                  <h3 className={`font-bold flex items-center gap-2 ${activeTheme.accent}`}>
                    <BookOpen size={18} />
                    <span>تفسير الآية</span>
                  </h3>
                  {tafsirContent && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] opacity-65">
                      <span>{tafsirContent.sourceName}</span>
                      <span aria-hidden="true">•</span>
                      <span>{tafsirContent.isOffline ? 'متاح دون اتصال' : 'من المصدر الموثوق'}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" dir="ltr">
                  <button
                    onClick={handleDownloadTafsir}
                    disabled={tafsirDownloading}
                    aria-label="تنزيل تفسير ابن كثير للعمل دون اتصال"
                    title="تنزيل تفسير ابن كثير للعمل دون اتصال"
                    className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${tafsirDownloading ? 'opacity-45' : 'hover:bg-black/5 active:scale-95'}`}
                  >
                    <Download size={17} />
                  </button>
                  <button
                    onClick={() => setShowTafsir(false)}
                    aria-label="إغلاق التفسير"
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-95"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar" dir="rtl">
                {tafsirLoading ? (
                  <div className="flex justify-center py-8">
                    <SakeenahLineSpinner size={32} color={activeTheme.accent} label="جارٍ تحميل تفسير ابن كثير" />
                  </div>
                ) : (
                  <>
                    <div className="mb-4 rounded-2xl border border-[#b88a4f]/15 bg-[#b88a4f]/5 px-3 py-2 text-right text-[11px] leading-relaxed opacity-80">
                      تفسير ابن كثير — المصدر: Quran.com / Quran Foundation
                      {tafsirContent?.sourceUrl && (
                        <a
                          href={tafsirContent.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mr-2 underline decoration-[#b88a4f]/50 underline-offset-2 hover:text-[#b88a4f]"
                        >
                          فتح المصدر
                        </a>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="leading-loose text-sm sm:text-base font-medium opacity-90 whitespace-pre-wrap">
                        {tafsirContent?.text}
                      </p>
                    </div>
                    {tafsirDownloadMessage && (
                      <div className="mt-5 rounded-2xl border border-[#b88a4f]/15 px-3 py-2 text-right text-[11px] leading-relaxed" aria-live="polite">
                        {tafsirDownloading && <span className="ml-1 tabular-nums">{toArabicDigits(tafsirDownloadPercent)}٪</span>}
                        {tafsirDownloadMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
