import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Library,
  BookOpen,
  Search,
  Bookmark,
  Share2,
  Copy,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Filter,
  Check,
  RotateCcw,
  BookMarked,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  List,
  AArrowUp,
  AArrowDown,
  Info,
  Award,
  BookText,
  BookmarkCheck,
  RefreshCw,
  AlertCircle,
  Flag,
  MessageSquare,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Download,
} from "lucide-react";
import {
  HadithBookInfo,
  HadithChapter,
  HadithItem,
  HadithBookmark,
  HadithListResponse,
} from "../types/hadith.types";
import { HadithOfflineSearchService } from "../services/HadithOfflineSearchService";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";

interface HadithBooksScreenProps {
  onBack?: () => void;
  onHideNavChange?: (hide: boolean) => void;
  onOpenSakinaLibrary?: () => void;
}

// Local Storage Keys
const BOOKMARKS_STORAGE_KEY = "sakeenah_hadith_bookmarks_v1";
const LAST_READ_STORAGE_KEY = "sakeenah_hadith_last_read_v1";
const REPORTS_STORAGE_KEY = "sakeenah_hadith_reports_v1";
const DISCLAIMER_STORAGE_KEY = "sakeenah_hadith_disclaimer_dismissed_v1";

async function readHadithJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`تعذر تحميل بيانات الحديث (رمز ${response.status})`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("استجابة بيانات الحديث غير صالحة");
  }
}

interface HadithReport {
  id: string;
  bookId: string;
  bookTitle: string;
  hadithnumber: number;
  chapterTitle: string;
  category: string;
  note: string;
  createdAt: number;
}

// Fallback static list of books for maximum client resilience
const FALLBACK_BOOKS: HadithBookInfo[] = [
  {
    id: "bukhari",
    titleArabic: "صحيح البخاري",
    authorArabic: "الإمام محمد بن إسماعيل البخاري",
    authorDeath: "256 هـ",
    hadithsCount: 7589,
    chaptersCount: 98,
    description: "أصح كتاب بعد كتاب الله تعالى، جمع فيه الإمام البخاري الأحاديث الصحيحة المسندة عن رسول الله ﷺ.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-bukhari",
    coverImage: "/images/hadith/author_bukhari.webp",
  },
  {
    id: "muslim",
    titleArabic: "صحيح مسلم",
    authorArabic: "الإمام مسلم بن الحجاج النيسابوري",
    authorDeath: "261 هـ",
    hadithsCount: 7563,
    chaptersCount: 57,
    description: "ثاني أصح كتب الحديث الشريف، امتاز بحسن الترتيب والصياغة والاستيعاب للطرق والأسانيد.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-muslim",
    coverImage: "/images/hadith/author_muslim.webp",
  },
  {
    id: "abudawud",
    titleArabic: "سنن أبي داود",
    authorArabic: "الإمام أبو داود سليمان بن الأشعث السجستاني",
    authorDeath: "275 هـ",
    hadithsCount: 5274,
    chaptersCount: 44,
    description: "أحد أهم السنن الأربعة، ركز فيه مصنفه على أحاديث الأحكام والسنن الفقهية المرفوعة.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-abudawud",
    coverImage: "/images/hadith/author_abudawud.png",
  },
  {
    id: "tirmidhi",
    titleArabic: "جامع الترمذي",
    authorArabic: "الإمام أبو عيسى محمد بن عيسى الترمذي",
    authorDeath: "279 هـ",
    hadithsCount: 3998,
    chaptersCount: 50,
    description: "معروف بالجامع والسنن، تميز بذكر مذاهب الفقهاء وبيان درجات الأحاديث من الصحة والحسن والضعف.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-tirmidhi",
    coverImage: "/images/hadith/author_tirmidhi.png",
  },
  {
    id: "nasai",
    titleArabic: "سنن النسائي (المجتبى)",
    authorArabic: "الإمام أحمد بن شعيب النسائي",
    authorDeath: "303 هـ",
    hadithsCount: 5765,
    chaptersCount: 52,
    description: "أشد السنن انتقاءً للرجال وأقلها حديثاً ضعيفاً بعد الصحيحين، اشتمل على الدقائق الفقهية والعلل.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-nasai",
    coverImage: "/images/hadith/author_nasai.png",
  },
  {
    id: "ibnmajah",
    titleArabic: "سنن ابن ماجه",
    authorArabic: "الإمام أبو عبد الله محمد بن يزيد ابن ماجه",
    authorDeath: "273 هـ",
    hadithsCount: 4343,
    chaptersCount: 38,
    description: "خاتم الكتب الستة، امتاز بحسن التبويب وكثرة زوائده على الأمهات الخمس من الأحاديث والسنن.",
    category: "الكتب الستة",
    badgeColor: "bg-[#deab65]/20 text-[#8a6a3d] border-[#deab65]/40",
    bgGradient: "from-[#deab65]/10 via-[#deab65]/5 to-transparent",
    editionSlug: "ara-ibnmajah",
    coverImage: "/images/hadith/author_ibnmajah.png",
  },
  {
    id: "malik",
    titleArabic: "موطأ الإمام مالك",
    authorArabic: "الإمام مالك بن أنس الأصبحي",
    authorDeath: "179 هـ",
    hadithsCount: 1858,
    chaptersCount: 62,
    description: "أقدم مدونة حديثية وفقهية جامعة وصلتنا بحالة ممتازة، من أصح الآثار والسنن عن دار الهجرة.",
    category: "الموطآت والمسانيد",
    badgeColor: "bg-[#2b1a10]/12 text-[#2b1a10] border-[#2b1a10]/25",
    bgGradient: "from-[#2b1a10]/10 via-[#2b1a10]/5 to-transparent",
    editionSlug: "ara-malik",
    coverImage: "/images/hadith/author_malik.png",
  },
  {
    id: "nawawi",
    titleArabic: "الأربعون النووية",
    authorArabic: "الإمام يحيى بن شرف النووي",
    authorDeath: "676 هـ",
    hadithsCount: 42,
    chaptersCount: 2,
    description: "مجموعة جوامع كلم النبي ﷺ ومباني الإسلام والأحكام التي عليها مدار الدين.",
    category: "الأربعينيات والقدسيات",
    badgeColor: "bg-amber-950/15 text-amber-900 border-amber-800/30",
    bgGradient: "from-amber-900/10 via-amber-800/5 to-transparent",
    editionSlug: "ara-nawawi",
    coverImage: "/images/hadith/author_nawawi.png",
  },
  {
    id: "qudsi",
    titleArabic: "الأحاديث القدسية",
    authorArabic: "مجموعة من الأئمة الحفاظ",
    authorDeath: "متنوع",
    hadithsCount: 40,
    chaptersCount: 2,
    description: "الأحاديث التي يرويها النبي ﷺ عن ربه عز وجل بألفاظ جامعة معظمة ترقق القلوب.",
    category: "الأربعينيات والقدسيات",
    badgeColor: "bg-amber-950/15 text-amber-900 border-amber-800/30",
    bgGradient: "from-amber-900/10 via-amber-800/5 to-transparent",
    editionSlug: "ara-qudsi",
    coverImage: "/images/hadith/author_qudsiyyah.png",
  },
];

// Localize English Hadith grades to high-quality classical Arabic labels
export function localizeHadithGrade(grade: string | undefined): string | undefined {
  if (!grade) return undefined;
  const trimmed = grade.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "sahih" || lower.includes("صحيح")) return "صحيح";
  if (lower === "hasan" || lower.includes("حسن")) return "حسن";
  if (lower === "daif" || lower.includes("da'if") || lower.includes("ضعيف")) return "ضعيف";
  if (lower === "maudu" || lower.includes("mowdu") || lower.includes("موضوع")) return "موضوع";
  if (lower === "mursal" || lower.includes("مرسل")) return "مرسل";
  if (lower === "shadh" || lower.includes("شاذ")) return "شاذ";
  if (lower === "munkar" || lower.includes("منكر")) return "منكر";

  return trimmed
    .replace(/\bSahih\b/gi, "صحيح")
    .replace(/\bHasan\b/gi, "حسن")
    .replace(/\bDaif\b/gi, "ضعيف")
    .replace(/\bDa'if\b/gi, "ضعيف")
    .replace(/\bMaudu\b/gi, "موضوع");
}

export default function HadithBooksScreen({ onBack, onHideNavChange, onOpenSakinaLibrary }: HadithBooksScreenProps) {
  // State: Books metadata
  const [books, setBooks] = useState<HadithBookInfo[]>(FALLBACK_BOOKS);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);

  // Active View Mode: 'library' | 'book_reader' | 'bookmarks' | 'search_global' | 'reports'
  const [viewMode, setViewMode] = useState<"library" | "book_reader" | "bookmarks" | "search_global" | "reports">("library");

  // Notify parent layout whether navigation bar should be hidden (when in any inner page)
  useEffect(() => {
    onHideNavChange?.(viewMode !== "library");
    return () => {
      onHideNavChange?.(false);
    };
  }, [viewMode, onHideNavChange]);

  // Selected Book & Reader State
  const [selectedBook, setSelectedBook] = useState<HadithBookInfo | null>(null);
  const [chapters, setChapters] = useState<HadithChapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string>("all");
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");

  // Hadiths Pagination & Filter State
  const [hadiths, setHadiths] = useState<HadithItem[]>([]);
  const [loadingHadiths, setLoadingHadiths] = useState(false);
  const [hadithsError, setHadithsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalHadithsCount, setTotalHadithsCount] = useState(0);
  const [jumpHadithNum, setJumpHadithNum] = useState("");
  const [readerSearch, setReaderSearch] = useState("");

  // Search & Filter state for Library view
  const [libraryFilter, setLibraryFilter] = useState<string>("all");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<HadithItem[]>([]);
  const [loadingGlobalSearch, setLoadingGlobalSearch] = useState(false);

  // Bookmarks & Last Read State
  const [bookmarks, setBookmarks] = useState<HadithBookmark[]>([]);
  const [lastRead, setLastRead] = useState<{
    bookId: string;
    bookTitle: string;
    hadithnumber: number;
    chapterTitle: string;
  } | null>(null);

  // Typo Reports State
  const [reports, setReports] = useState<HadithReport[]>([]);
  const [reportingHadith, setReportingHadith] = useState<HadithItem | null>(null);
  const [reportCategory, setReportCategory] = useState("خطأ في التشكيل أو الإعراب");
  const [reportNote, setReportNote] = useState("");
  const [reportSuccessToast, setReportSuccessToast] = useState(false);

  // Custom UI Options
  const [fontSize, setFontSize] = useState(20);
  const [speakingHadithNum, setSpeakingHadithNum] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(() => {
    try {
      const dismissed = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
      return dismissed !== "true";
    } catch {
      return true;
    }
  });

  // Offline Indexing & Search Engine States
  const [downloadStats, setDownloadStats] = useState<Record<string, boolean>>({});
  const [isIndexing, setIsIndexing] = useState(false);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [bookProgressMap, setBookProgressMap] = useState<Record<string, number>>({});
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [indexingStatusText, setIndexingStatusText] = useState("");
  const [searchMethod, setSearchMethod] = useState<"online" | "offline">("online");
  const [isSearchScopeDropdownOpen, setIsSearchScopeDropdownOpen] = useState(false);
  const [downloadSuccessAnim, setDownloadSuccessAnim] = useState(false);

  // Load books, bookmarks, last read, and reports on mount
  useEffect(() => {
    fetchBooks();
    loadBookmarksFromStorage();
    loadLastReadFromStorage();
    loadReportsFromStorage();
  }, []);

  // Check offline status for loaded books
  const checkOfflineStats = useCallback(async (currentBooks: HadithBookInfo[] = books) => {
    if (!currentBooks || currentBooks.length === 0) return;
    try {
      const stats = await HadithOfflineSearchService.getDownloadStats(currentBooks);
      setDownloadStats(stats);

      const hasAnyDownloaded = Object.values(stats).some(v => v === true);
      setSearchMethod(hasAnyDownloaded ? "offline" : "online");
    } catch (err) {
      console.warn("Error checking offline search stats:", err);
    }
  }, [books]);

  // Handle toggling offline download/indexing for a single book
  const handleIndexBookToggle = async (book: HadithBookInfo) => {
    const isDownloaded = downloadStats[book.id];
    if (isDownloaded) {
      // Clear specific book
      await HadithOfflineSearchService.hadithBooksStore.removeItem(book.id);
      await HadithOfflineSearchService.searchMetaStore.removeItem(`updated_${book.id}`);
      setDownloadStats(prev => ({ ...prev, [book.id]: false }));
      setBookProgressMap(prev => ({ ...prev, [book.id]: 0 }));
      const stats = await HadithOfflineSearchService.getDownloadStats(books);
      const hasAny = Object.values(stats).some(v => v === true);
      if (!hasAny) setSearchMethod("online");
    } else {
      setIsIndexing(true);
      setDownloadingBookId(book.id);
      setIndexingProgress(0);
      setBookProgressMap(prev => ({ ...prev, [book.id]: 0 }));
      setIndexingStatusText(`جاري تهيئة تحميل كتاب ${book.titleArabic}...`);
      try {
        await HadithOfflineSearchService.downloadAndIndexBook(book, (pct, status) => {
          setIndexingStatusText(status);
          setIndexingProgress(pct);
          setBookProgressMap(prev => ({ ...prev, [book.id]: pct }));
        });
        setDownloadStats(prev => ({ ...prev, [book.id]: true }));
        setBookProgressMap(prev => ({ ...prev, [book.id]: 100 }));
        setSearchMethod("offline");
      } catch (err: any) {
        console.error("Error downloading book:", err);
        alert(`فشل التحميل: ${err.message || err}`);
      } finally {
        setIsIndexing(false);
        setDownloadingBookId(null);
        setIndexingProgress(0);
      }
    }
  };

  // Download and Index all Books to become Offline
  const handleIndexAllBooks = async () => {
    setIsIndexing(true);
    setIndexingProgress(0);
    try {
      const undownloaded = books.filter(b => !downloadStats[b.id]);
      if (undownloaded.length === 0) {
        setIndexingStatusText("الموسوعة الحديثية كاملة ومفهرسة أوفلاين بالفعل!");
        setDownloadSuccessAnim(true);
        setTimeout(() => {
          setDownloadSuccessAnim(false);
          setIsIndexing(false);
        }, 1200);
        return;
      }

      let done = 0;
      for (const b of undownloaded) {
        setDownloadingBookId(b.id);
        setBookProgressMap(prev => ({ ...prev, [b.id]: 0 }));
        setIndexingStatusText(`جاري تحميل وفهرسة ${b.titleArabic}...`);
        await HadithOfflineSearchService.downloadAndIndexBook(b, (pct, status) => {
          setIndexingStatusText(status);
          setBookProgressMap(prev => ({ ...prev, [b.id]: pct }));
          const eachWeight = 100 / undownloaded.length;
          const currentProgress = Math.floor((done * eachWeight) + (pct * eachWeight / 100));
          setIndexingProgress(currentProgress);
        });
        done++;
        setDownloadStats(prev => ({ ...prev, [b.id]: true }));
        setBookProgressMap(prev => ({ ...prev, [b.id]: 100 }));
      }

      setIndexingProgress(100);
      setIndexingStatusText("تم اكتمال تنزيل وتكشيف الموسوعة أوفلاين بالكامل!");
      setSearchMethod("offline");
      setDownloadSuccessAnim(true);
      setTimeout(() => {
        setDownloadSuccessAnim(false);
        setIsIndexing(false);
        setIndexingProgress(0);
        setDownloadingBookId(null);
      }, 1500);
    } catch (err: any) {
      console.error("Indexing error:", err);
      setIndexingStatusText(`فشلت الفهرسة: ${err.message || err}`);
      setTimeout(() => {
        setIsIndexing(false);
        setDownloadingBookId(null);
      }, 3000);
    }
  };

  // 1. Fetch Books List from API
  const fetchBooks = async () => {
    setLoadingBooks(true);
    setBooksError(null);
    try {
      const res = await fetch("/api/hadith/books");
      if (res.ok) {
        const data = await readHadithJson<{ success?: boolean; books?: HadithBookInfo[] }>(res);
        if (data.success && Array.isArray(data.books)) {
          setBooks(data.books);
          checkOfflineStats(data.books);
          return;
        }
      }
      setBooks(FALLBACK_BOOKS);
      checkOfflineStats(FALLBACK_BOOKS);
    } catch (err: any) {
      console.warn("Server books fetch failed, falling back to local book metadata:", err);
      setBooks(FALLBACK_BOOKS);
      checkOfflineStats(FALLBACK_BOOKS);
    } finally {
      setLoadingBooks(false);
    }
  };

  const loadBookmarksFromStorage = () => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (saved) {
        setBookmarks(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load bookmarks:", e);
    }
  };

  const loadLastReadFromStorage = () => {
    try {
      const saved = localStorage.getItem(LAST_READ_STORAGE_KEY);
      if (saved) {
        setLastRead(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load last read:", e);
    }
  };

  const loadReportsFromStorage = () => {
    try {
      const saved = localStorage.getItem(REPORTS_STORAGE_KEY);
      if (saved) {
        setReports(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load reports:", e);
    }
  };

  const saveBookmarkToggle = (hadith: HadithItem) => {
    const id = `${hadith.bookId}_${hadith.hadithnumber}`;
    const exists = bookmarks.some((b) => b.id === id);

    let updated: HadithBookmark[];
    if (exists) {
      updated = bookmarks.filter((b) => b.id !== id);
    } else {
      const newItem: HadithBookmark = {
        id,
        bookId: hadith.bookId,
        bookTitle: hadith.bookTitle,
        hadithnumber: hadith.hadithnumber,
        chapterTitle: hadith.chapterTitle,
        textSnippet: hadith.text.slice(0, 120) + "...",
        savedAt: Date.now(),
      };
      updated = [newItem, ...bookmarks];
    }
    setBookmarks(updated);
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Error saving bookmarks:", e);
    }
  };

  const isBookmarked = (hadith: HadithItem) => {
    return bookmarks.some((b) => b.id === `${hadith.bookId}_${hadith.hadithnumber}`);
  };

  const updateLastRead = (hadith: HadithItem) => {
    const lr = {
      bookId: hadith.bookId,
      bookTitle: hadith.bookTitle,
      hadithnumber: hadith.hadithnumber,
      chapterTitle: hadith.chapterTitle,
    };
    setLastRead(lr);
    try {
      localStorage.setItem(LAST_READ_STORAGE_KEY, JSON.stringify(lr));
    } catch (e) {
      console.warn("Error saving last read:", e);
    }
  };

  // Submit Typo Report
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingHadith || !reportNote.trim()) return;

    const newReport: HadithReport = {
      id: `report_${Date.now()}`,
      bookId: reportingHadith.bookId,
      bookTitle: reportingHadith.bookTitle,
      hadithnumber: reportingHadith.hadithnumber,
      chapterTitle: reportingHadith.chapterTitle,
      category: reportCategory,
      note: reportNote.trim(),
      createdAt: Date.now(),
    };

    const updated = [newReport, ...reports];
    setReports(updated);
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Error saving report:", err);
    }

    setReportingHadith(null);
    setReportNote("");
    setReportSuccessToast(true);
    setTimeout(() => setReportSuccessToast(false), 3500);
  };

  const handleDeleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    try {
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Error deleting report:", err);
    }
  };

  // Load local hadiths directly from local DB for 100% offline functionality
  const loadLocalHadiths = useCallback(
    (allLocalHadiths: HadithItem[], chapterId: string, p: number, search: string) => {
      setLoadingHadiths(true);
      setHadithsError(null);
      try {
        let filtered = allLocalHadiths;

        // Filter by chapter
        if (chapterId && chapterId !== "all") {
          filtered = filtered.filter((h) => h.chapterId === chapterId);
        }

        // Filter by search text
        if (search.trim()) {
          const qLower = search.trim().toLowerCase();
          const normQuery = HadithOfflineSearchService.normalizeArabic(qLower);
          const queryNum = parseInt(search.trim(), 10);

          filtered = filtered.filter((h) => {
            const normText = HadithOfflineSearchService.normalizeArabic(h.text);
            const normCh = HadithOfflineSearchService.normalizeArabic(h.chapterTitle);
            const hNumStr = h.hadithnumber?.toString().trim() || "";
            const arabicNumStr = h.arabicnumber?.toString().trim() || "";
            const exactNumber = search.trim();

            return (
              normText.includes(normQuery) ||
              hNumStr === exactNumber ||
              arabicNumStr === exactNumber ||
              (!isNaN(queryNum) && (hNumStr === queryNum.toString() || arabicNumStr === queryNum.toString())) ||
              normCh.includes(normQuery)
            );
          });
        }

        const total = filtered.length;
        const limit = 20;
        const totalPagesCount = Math.ceil(total / limit) || 1;
        const startIndex = (p - 1) * limit;
        const paginated = filtered.slice(startIndex, startIndex + limit);

        setHadiths(paginated);
        setPage(p);
        setTotalPages(totalPagesCount);
        setTotalHadithsCount(total);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err: any) {
        console.error("Error loading local hadiths:", err);
        setHadithsError("حدث خطأ أثناء تحميل الأحاديث المحلية");
      } finally {
        setLoadingHadiths(false);
      }
    },
    []
  );

  // Open a specific Book
  const handleOpenBook = async (book: HadithBookInfo, chapterIdToOpen: string = "all", initialPage: number = 1) => {
    setSelectedBook(book);
    setActiveChapterId(chapterIdToOpen);
    setPage(initialPage);
    setReaderSearch("");
    setViewMode("book_reader");
    setHadiths([]);

    // Fetch Chapters list
    setLoadingChapters(true);
    try {
      // 1. Check if we have offline data for this book!
      const isDownloaded = downloadStats[book.id];
      if (isDownloaded) {
        const localData = await HadithOfflineSearchService.hadithBooksStore.getItem<{
          bookId: string;
          title: string;
          hadiths: HadithItem[];
        }>(book.id);

        if (localData && localData.hadiths) {
          // Generate chapters list from local data dynamically
          const chapterMap = new Map<string, { title: string; count: number }>();
          for (const h of localData.hadiths) {
            const cid = h.chapterId || "0";
            const existing = chapterMap.get(cid);
            if (existing) {
              existing.count++;
            } else {
              chapterMap.set(cid, {
                title: h.chapterTitle || `الباب رقم ${cid}`,
                count: 1,
              });
            }
          }

          const localChapters: HadithChapter[] = Array.from(chapterMap.entries()).map(([cid, info]) => ({
            id: cid,
            number: parseInt(cid, 10) || 0,
            title: info.title,
            hadithCount: info.count,
          }));
          localChapters.sort((a, b) => a.number - b.number);
          setChapters(localChapters);
          setLoadingChapters(false);
          // Load local hadiths directly!
          loadLocalHadiths(localData.hadiths, chapterIdToOpen, initialPage, "");
          return;
        }
      }

      // Fallback to online fetch if not downloaded
      const res = await fetch(`/api/hadith/book/${book.id}`);
      const data = await readHadithJson<{ success?: boolean; chapters?: HadithChapter[] }>(res);
      if (data.success) {
        setChapters(data.chapters || []);
      }
    } catch (e) {
      console.error("Error fetching chapters:", e);
    } finally {
      setLoadingChapters(false);
    }

    // Fetch Hadiths from network
    fetchHadiths(book.id, chapterIdToOpen, initialPage, "");
  };

  // Fetch Hadiths for active book, chapter, page, search
  const fetchHadiths = useCallback(
    async (bookId: string, chapterId: string, p: number, search: string) => {
      setLoadingHadiths(true);
      setHadithsError(null);

      // Check if downloaded offline!
      if (downloadStats[bookId]) {
        try {
          const localData = await HadithOfflineSearchService.hadithBooksStore.getItem<{
            bookId: string;
            title: string;
            hadiths: HadithItem[];
          }>(bookId);
          if (localData && localData.hadiths) {
            loadLocalHadiths(localData.hadiths, chapterId, p, search);
            return;
          }
        } catch (err) {
          console.warn("Could not load hadiths offline, falling back to online fetch", err);
        }
      }

      try {
        const queryParams = new URLSearchParams({
          page: p.toString(),
          limit: "20",
          chapter: chapterId,
        });
        if (search.trim()) {
          queryParams.set("search", search.trim());
        }

        const res = await fetch(`/api/hadith/book/${bookId}/hadiths?${queryParams.toString()}`);
        const data = await readHadithJson<HadithListResponse & { success: boolean; error?: string }>(res);

        if (data.success) {
          setHadiths(data.hadiths);
          setTotalPages(data.totalPages);
          setTotalHadithsCount(data.total);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          throw new Error(data.error || "تعذر جلب الأحاديث");
        }
      } catch (err: any) {
        console.error("Error fetching hadiths:", err);
        setHadithsError(err.message || "حدث خطأ أثناء تحميل الأحاديث");
      } finally {
        setLoadingHadiths(false);
      }
    },
    [downloadStats, loadLocalHadiths]
  );

  const handleChapterSelect = (chId: string) => {
    setActiveChapterId(chId);
    setPage(1);
    setShowChapterDrawer(false);
    if (selectedBook) {
      fetchHadiths(selectedBook.id, chId, 1, readerSearch);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    if (selectedBook) {
      fetchHadiths(selectedBook.id, activeChapterId, newPage, readerSearch);
    }
  };

  const handleReaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (selectedBook) {
      fetchHadiths(selectedBook.id, activeChapterId, 1, readerSearch);
    }
  };

  const handleJumpToHadith = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jumpHadithNum || !selectedBook) return;
    setReaderSearch(jumpHadithNum.trim());
    setActiveChapterId("all");
    setPage(1);
    fetchHadiths(selectedBook.id, "all", 1, jumpHadithNum.trim());
  };

  // Global Search across all books (Offline-First Advanced NLP)
  const handleGlobalSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchQuery.trim()) return;

    setViewMode("search_global");
    setLoadingGlobalSearch(true);
    setGlobalSearchResults([]);

    const hasAnyDownloaded = Object.values(downloadStats).some(v => v === true);

    if (searchMethod === "offline" && hasAnyDownloaded) {
      try {
        // Run our incredibly advanced offline search algorithm!
        const results = await HadithOfflineSearchService.searchOffline(globalSearchQuery.trim(), "all");
        setGlobalSearchResults(results);
      } catch (err) {
        console.error("Offline search failed, falling back to online:", err);
        await runOnlineGlobalSearch();
      } finally {
        setLoadingGlobalSearch(false);
      }
    } else {
      await runOnlineGlobalSearch();
    }
  };

  const runOnlineGlobalSearch = async () => {
    try {
      const res = await fetch(`/api/hadith/search?q=${encodeURIComponent(globalSearchQuery.trim())}&limit=40`);
      const data = await readHadithJson<{ success?: boolean; results?: HadithItem[] }>(res);
      if (data.success) {
        setGlobalSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      setLoadingGlobalSearch(false);
    }
  };

  // Copy Hadith Text
  const handleCopyHadith = (hadith: HadithItem) => {
    const textToCopy = `[${hadith.bookTitle} - حديث رقم ${hadith.hadithnumber}]\n${hadith.chapterTitle}\n\n${hadith.text}\n\nتطبيق سكينة - الموسوعة الحديثية`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(`${hadith.bookId}_${hadith.hadithnumber}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Share Hadith
  const handleShareHadith = async (hadith: HadithItem) => {
    const shareData = {
      title: `${hadith.bookTitle} - حديث ${hadith.hadithnumber}`,
      text: `"${hadith.text}"\n\n[${hadith.bookTitle} - ${hadith.chapterTitle}]`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        // user cancelled share
      }
    } else {
      handleCopyHadith(hadith);
    }
  };

  // Speech Audio
  const handleSpeechHadith = (hadith: HadithItem) => {
    if ("speechSynthesis" in window) {
      if (speakingHadithNum === hadith.hadithnumber) {
        window.speechSynthesis.cancel();
        setSpeakingHadithNum(null);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(hadith.text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.9;

      utterance.onend = () => setSpeakingHadithNum(null);
      utterance.onerror = () => setSpeakingHadithNum(null);

      setSpeakingHadithNum(hadith.hadithnumber);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("خاصية القراءة الصوتية غير مدعومة في متصفحك الحالي.");
    }
  };

  // Filtered books list
  const filteredBooks = useMemo(() => {
    if (libraryFilter === "all") return books;
    return books.filter((b) => b.category === libraryFilter);
  }, [books, libraryFilter]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#ece7de] text-[#2b1a10] font-sans pb-28 relative flex flex-col"
    >
      {/* ── Toast Notification for Typo Report ── */}
      <AnimatePresence>
        {reportSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 cut-crystal-capsule-dark px-5 py-2.5 flex items-center gap-2 text-[#fdfcfb] text-xs font-bold shadow-2xl border border-[#deab65]/40 backdrop-blur-xl"
          >
            <ShieldCheck className="w-4 h-4 text-[#deab65]" />
            <span>تم تدوين وحفظ ملاحظتك وتصحيحك بنجاح في سجل بلاغاتك المحلية!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FLOATING TOP HEADER (FIXED VIEWPORT CAPSULES) ── */}
      <div className="fixed top-5 left-4 right-4 md:left-8 md:right-8 z-40 flex items-center justify-between pointer-events-none">
        {/* Right Side (RTL): Return Button (if in subview) & Title Capsule */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Return button if inside a book or subview */}
          {viewMode !== "library" && (
            <button
              onClick={() => setViewMode("library")}
              className="w-10 h-10 cut-crystal-capsule flex items-center justify-center text-[#2b1a10] active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
              title="العودة للمكتبة"
              aria-label="العودة"
            >
              <ChevronRight className="w-5 h-5 text-[#2b1a10]" />
            </button>
          )}

          {/* Title Capsule */}
          <div className="px-4 h-10 cut-crystal-capsule flex items-center justify-center text-[#2b1a10] shadow-2xs">
            <span className="text-[13.5px] font-bold whitespace-nowrap">
              {viewMode === "book_reader" && selectedBook
                ? selectedBook.titleArabic
                : viewMode === "bookmarks"
                ? "الأحاديث المحفوظة"
                : viewMode === "reports"
                ? "سجل ملاحظاتي وبلاغاتي"
                : viewMode === "search_global"
                ? "نتائج البحث الشامل"
                : "الكتب"}
            </span>
          </div>
        </div>

        {/* Left Side (RTL): Grouped Combined Capsule for Bookmarks & Notes */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="h-10 p-1 cut-crystal-capsule flex items-center gap-1 shadow-2xs">
            {/* Bookmarks Section */}
            <button
              onClick={() => setViewMode(viewMode === "bookmarks" ? "library" : "bookmarks")}
              className={`h-8 px-3 rounded-[20px] flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === "bookmarks"
                  ? "bg-[#2b1a10] text-[#fdfcfb] shadow-xs"
                  : "text-[#2b1a10] hover:bg-[#2b1a10]/5"
              }`}
              title="المحفوظات"
            >
              <BookmarkCheck className={`w-3.5 h-3.5 ${viewMode === "bookmarks" ? "text-[#deab65]" : "text-[#8a6a3d]"}`} />
              <span className="hidden sm:inline">المحفوظات</span>
              {bookmarks.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-[#deab65] text-[#2b1a10] font-black rounded-full leading-none flex items-center justify-center min-w-[16px]">
                  {bookmarks.length}
                </span>
              )}
            </button>

            {/* Notes / Reports Section */}
            <button
              onClick={() => setViewMode(viewMode === "reports" ? "library" : "reports")}
              className={`h-8 px-3 rounded-[20px] flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                viewMode === "reports"
                  ? "bg-[#2b1a10] text-[#fdfcfb] shadow-xs"
                  : "text-[#2b1a10] hover:bg-[#2b1a10]/5"
              }`}
              title="ملاحظاتي وبلاغاتي"
            >
              <Flag className={`w-3.5 h-3.5 ${viewMode === "reports" ? "text-[#deab65]" : "text-[#8a6a3d]"}`} />
              <span className="hidden sm:inline">ملاحظاتي</span>
              {reports.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-[#deab65] text-[#2b1a10] font-black rounded-full leading-none flex items-center justify-center min-w-[16px]">
                  {reports.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 pt-20 sm:pt-24 pb-24">

        {/* ── 1. SCHOLARLY DISCLAIMER NOTICE (تنويه الموثوقية العلمي) ── */}
        {showDisclaimer && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 cut-crystal-satin border border-amber-900/10 rounded-[22px] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#deab65]/15 text-[#8a6a3d] shrink-0 mt-0.5 md:mt-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#2b1a10] text-sm">تنويه موثوقية وإخلاء مسؤولية علمي:</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#deab65]/20 text-[#8a6a3d] font-black text-[11px] border border-[#deab65]/30">
                    الترقيم الدولي / طبعة دار السلام
                  </span>
                </div>
                <p className="text-[#524336] leading-relaxed">
                  هذه الموسوعة الرقمية مخصصة للاستئناس والمدارسة والمطالعة الميسرة. نظراً لطبيعة السحب البرمجي واختلاف طبعات الترقيم الحديثية، يُنصح الطلاب والباحثون بالرجوع للنسخ المطبوعة المحققة المعتمدة في الاستدلالات الدقيقة والمسائل الفقهية.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowDisclaimer(false);
                try {
                  localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
                } catch (e) {
                  console.error("Error saving disclaimer preference:", e);
                }
              }}
              className="px-3.5 py-1.5 cut-crystal-capsule text-xs font-bold text-[#7f6a55] hover:text-[#2b1a10] shrink-0 self-end md:self-center cursor-pointer"
            >
              فهمت ذلك
            </button>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VIEW 1: LIBRARY MAIN VIEW (قائمة الكتب الستة)
            ════════════════════════════════════════════════════════════════ */}
        {viewMode === "library" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Last Read Banner (if exists) */}
            {lastRead && (
              <div className="p-5 cut-crystal-panel rounded-[26px] border border-[#deab65]/30 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 z-10">
                  <div className="flex items-center gap-2 text-[#deab65] text-xs font-extrabold">
                    <BookMarked className="w-4 h-4" />
                    <span>مواصلة القراءة السابقة</span>
                  </div>
                  <h3 className="text-base font-bold text-[#2b1a10]">
                    {lastRead.bookTitle} - <span className="text-[#deab65]">حديث رقم [{lastRead.hadithnumber}]</span>
                  </h3>
                  <p className="text-xs text-[#524336] line-clamp-1">{lastRead.chapterTitle}</p>
                </div>

                <button
                  onClick={() => {
                    const bk = books.find((b) => b.id === lastRead.bookId);
                    if (bk) {
                      handleOpenBook(bk, "all", 1);
                      setReaderSearch(lastRead.hadithnumber.toString());
                    }
                  }}
                  className="z-10 px-4 py-2.5 cut-crystal-capsule-gold text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-sm self-start sm:self-center cursor-pointer"
                >
                  <span>متابعة من هنا</span>
                  <ChevronLeft className="w-4 h-4 text-[#2b1a10]" />
                </button>

                <Library className="absolute -left-4 -bottom-4 w-32 h-32 text-[#2b1a10]/5 pointer-events-none" />
              </div>
            )}

            {onOpenSakinaLibrary && (
              <motion.button
                type="button"
                onClick={onOpenSakinaLibrary}
                whileTap={{ scale: 0.985 }}
                className="group flex w-full items-center justify-between gap-4 rounded-[28px] cut-crystal-panel p-5 text-right shadow-sm transition-colors hover:bg-[#2b1a10]/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#2b1a10] text-[#deab65] shadow-sm">
                    <BookText className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-black text-[#b88a4f]">
                      <span>مكتبة سكينة</span>
                      <span className="rounded-full bg-[#deab65]/20 px-2 py-1 text-[10px]">قسم جديد</span>
                    </div>
                    <h2 className="truncate text-base font-black text-[#2b1a10]">الدروس والمحاضرات</h2>
                    <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#7f6a55]">دروس مرتبة من الشيخ إلى السلسلة ثم الدرس، من مصادر يتم اعتمادها ومراجعتها.</p>
                  </div>
                </div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-[#b88a4f] transition-transform group-hover:-translate-x-0.5" />
              </motion.button>
            )}

            {/* Global Search Bar with Integrated Scope Dropdown Toggle */}
            <form onSubmit={handleGlobalSearchSubmit} className="relative z-30">
              <div className="cut-crystal-input flex items-center px-4 py-2">
                <Search className="w-5 h-5 text-[#deab65] shrink-0 ml-3" />
                <input
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="ابحث بالنص أو الكلمة أو رقم الحديث في جميع الكتب النبوية..."
                  className="w-full bg-transparent border-none text-sm text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none py-1 font-sans"
                />

                {/* Search Button Capsule with Separated Arrow Button */}
                <div className="flex items-center gap-[1px] shrink-0 mr-2 cut-crystal-capsule-gold overflow-hidden p-0.5 rounded-full shadow-xs">
                  {/* Primary Action Button: Execute Global Search */}
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-black text-[#2b1a10] hover:bg-black/5 transition cursor-pointer flex items-center gap-1 rounded-r-full"
                  >
                    <span>بحث شامل</span>
                  </button>

                  {/* Divider */}
                  <div className="w-[1px] h-4 bg-[#2b1a10]/20 my-auto" />

                  {/* Secondary Action Button: Toggle Search Scope Dropdown */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsSearchScopeDropdownOpen(!isSearchScopeDropdownOpen);
                    }}
                    className="px-2 py-1 text-xs font-black text-[#2b1a10] hover:bg-black/5 transition cursor-pointer flex items-center justify-center rounded-l-full"
                    title="خيارات ونطاق البحث"
                    aria-label="خيارات ونطاق البحث"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#2b1a10] transition-transform duration-300 ${
                        isSearchScopeDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Glassmorphism Dropdown Menu */}
              <AnimatePresence>
                {isSearchScopeDropdownOpen && (
                  <>
                    {/* Backdrop Overlay for closing when clicking outside */}
                    <div
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setIsSearchScopeDropdownOpen(false)}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="absolute left-0 mt-2 w-56 max-h-[320px] overflow-y-auto cut-crystal-panel rounded-[20px] shadow-2xl z-40 p-3 space-y-2.5 hide-scrollbar"
                      style={{ position: "absolute" }}
                    >
                      {/* Dropdown Top Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#e6dccf]/60 px-0.5">
                        <span className="text-[11.5px] font-black text-[#2b1a10]">
                          محرك البحث
                        </span>

                        {/* Settings-styled Switch for Offline / Online Mode */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-[#7f6a55]">
                            {searchMethod === "offline" ? "أوفلاين" : "أونلاين"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSearchMethod(searchMethod === "offline" ? "online" : "offline")}
                            className="relative w-9 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none flex items-center shadow-inner cursor-pointer"
                            style={{
                              backgroundColor: searchMethod === "offline" ? "#b88a4f" : "#e6dccf",
                              justifyContent: searchMethod === "offline" ? "flex-start" : "flex-end",
                            }}
                            title={searchMethod === "offline" ? "تبديل للوضع الأونلاين" : "تبديل للوضع الأوفلاين"}
                          >
                            <motion.div
                              layout
                              transition={{ type: "spring", stiffness: 500, damping: 28 }}
                              className="w-4 h-4 rounded-full bg-white shadow-md border border-white flex items-center justify-center shrink-0"
                            >
                              {searchMethod === "offline" ? (
                                <WifiOff className="w-2.5 h-2.5 text-[#b88a4f]" />
                              ) : (
                                <Wifi className="w-2.5 h-2.5 text-[#7f6a55]" />
                              )}
                            </motion.div>
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Body Content */}
                      {searchMethod === "offline" ? (
                        <>
                          {isIndexing ? (
                            /* Real Downloading & Progress State */
                            <div className="py-2.5 px-1 space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-[#7f6a55]">
                                <span className="text-[#2b1a10] text-[11.5px] font-extrabold flex items-center gap-1.5">
                                  <SakeenahLineSpinner size={32} color="#deab65" label="جارٍ تحميل الكتاب" className="shrink-0" />
                                  جاري التحميل...
                                </span>
                                <span className="text-[#deab65] font-black text-[12px]">{indexingProgress}%</span>
                              </div>

                              {/* Rounded Progress Bar */}
                              <div className="w-full h-2 bg-[#2b1a10]/10 rounded-full overflow-hidden p-[1px] border border-[#e6dccf]">
                                <div
                                  className="h-full bg-gradient-to-r from-[#deab65] to-[#8a6a3d] rounded-full transition-all duration-300"
                                  style={{ width: `${indexingProgress}%` }}
                                />
                              </div>

                              <p className="text-[10.5px] text-[#7f6a55] font-bold text-center truncate">
                                {indexingStatusText}
                              </p>
                            </div>
                          ) : downloadSuccessAnim ? (
                            /* Success Animation Checkmark */
                            <motion.div
                              initial={{ scale: 0.7, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.7, opacity: 0 }}
                              transition={{ type: "spring", damping: 15, stiffness: 300 }}
                              className="py-5 flex flex-col items-center justify-center space-y-2"
                            >
                              <div className="w-10 h-10 rounded-full bg-[#deab65]/20 text-[#8a6a3d] flex items-center justify-center border border-[#deab65]/40 shadow-sm">
                                <Check className="w-5 h-5 stroke-[3]" />
                              </div>
                              <span className="text-xs font-black text-[#2b1a10]">تم اكتمال التنزيل بنجاح!</span>
                            </motion.div>
                          ) : !Object.values(downloadStats).some((v) => v === true) ? (
                            /* Un-downloaded Prompt & Button */
                            <div className="py-2 space-y-3 text-center">
                              <p className="text-[11.5px] text-[#524336] font-bold leading-relaxed">
                                اضغط للتنزيل للبحث بدون إنترنت
                              </p>
                              <button
                                type="button"
                                onClick={handleIndexAllBooks}
                                className="w-full py-2 px-4 cut-crystal-capsule-gold text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] cursor-pointer"
                              >
                                <Download className="w-4 h-4 text-[#2b1a10]" />
                                <span>تنزيل الآن</span>
                              </button>
                            </div>
                          ) : (
                            /* Downloaded Books Checklist / Actions */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-extrabold text-[#7f6a55] pb-1">
                                <span>حالة كتب الحديث أوفلاين:</span>
                                {books.some((b) => !downloadStats[b.id]) && (
                                  <button
                                    type="button"
                                    onClick={handleIndexAllBooks}
                                    className="text-[10px] text-[#deab65] hover:underline font-bold cursor-pointer"
                                  >
                                    تنزيل الكل
                                  </button>
                                )}
                              </div>
                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
                                {books.map((b) => {
                                  const isDownloaded = downloadStats[b.id];
                                  return (
                                    <div
                                      key={b.id}
                                      className="p-2 rounded-xl bg-[#f7f2ea]/80 border border-[#e6dccf]/80 flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {isDownloaded ? (
                                          <Check className="w-3.5 h-3.5 text-[#deab65] shrink-0" />
                                        ) : (
                                          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                        )}
                                        <span className="font-bold text-[#2b1a10] text-[11.5px] truncate">
                                          {b.titleArabic}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleIndexBookToggle(b)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition shrink-0 ${
                                          isDownloaded
                                            ? "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                            : "bg-[#deab65]/20 text-[#8a6a3d] hover:bg-[#deab65]/30"
                                        }`}
                                      >
                                        {isDownloaded ? "حذف" : "تحميل"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        /* Online Mode Indicator */
                        <div className="py-3 px-2 text-center space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#deab65]/15 text-[#2b1a10] text-[11px] font-extrabold border border-[#deab65]/35">
                            <Wifi className="w-3.5 h-3.5 text-[#deab65]" />
                            <span>البحث السحابي أونلاين</span>
                          </div>
                          <p className="text-[11px] text-[#7f6a55] font-bold leading-relaxed pt-0.5">
                            يتم البحث في السيرفر أونلاين عبر كافة كتب الأحاديث النبوية المتاحة.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </form>

            {/* Category Filter Pills */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-2">
                {[
                  { id: "all", label: `جميع الكتب (${books.length})` },
                  { id: "الكتب الستة", label: "الكتب الستة" },
                  { id: "الموطآت والمسانيد", label: "الموطأ والمسند" },
                  { id: "الأربعينيات والقدسيات", label: "الأربعينيات والقدسيات" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLibraryFilter(tab.id)}
                    className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      libraryFilter === tab.id
                        ? "cut-crystal-capsule-gold"
                        : "cut-crystal-capsule text-[#524336] hover:text-[#2b1a10]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-[#7f6a55] whitespace-nowrap px-2">
                {filteredBooks.length} كتب متاحة
              </div>
            </div>

            {/* Loading & Error States */}
            {loadingBooks && (
              <div className="py-20 text-center space-y-3">
                <SakeenahLineSpinner size={40} color="#deab65" label="جارٍ تحميل فهرس الكتب" className="mx-auto" />
                <p className="text-sm font-bold text-[#7f6a55]">جاري تحميل فهرس الكتب الشريفة...</p>
              </div>
            )}

            {booksError && (
              <div className="p-6 cut-crystal-satin border border-rose-300 text-rose-900 text-center space-y-3">
                <p className="text-sm font-bold">{booksError}</p>
                <button
                  onClick={fetchBooks}
                  className="px-4 py-2 cut-crystal-capsule bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            )}

            {/* Books Grid */}
            {!loadingBooks && !booksError && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBooks.map((book) => {
                  const isDownloaded = downloadStats[book.id];
                  const isDownloadingThisBook = isIndexing && downloadingBookId === book.id;
                  const currentPct = bookProgressMap[book.id] ?? indexingProgress;
                  const hasCoverImage = Boolean(book.coverImage);

                  return (
                    <motion.div
                      key={book.id}
                      whileHover={{ y: -3 }}
                      className={`group relative overflow-hidden rounded-[26px] p-5 flex flex-col justify-between transition-all duration-500 shadow-md ${
                        hasCoverImage
                          ? "border border-[#deab65]/40 text-[#fdfcfb]"
                          : "cut-crystal-satin text-[#2b1a10]"
                      }`}
                    >
                      {/* Background Cover Image with 4:3 preservation, Dark Gradient & Film Grain Overlay */}
                      {hasCoverImage && (
                        <>
                          <img
                            src={book.coverImage}
                            alt={book.titleArabic}
                            width={1200}
                            height={900}
                            loading="eager"
                            decoding="async"
                            fetchPriority={book.id === "bukhari" || book.id === "muslim" ? "high" : "auto"}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out z-0"
                          />
                          {/* Multi-layered Vignette & Contrast Gradients for text legibility with high illustration clarity */}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0a]/85 via-[#1a0f0a]/45 to-[#1a0f0a]/25 z-1" />
                          <div className="absolute inset-0 border border-[#deab65]/25 rounded-[26px] pointer-events-none z-2" />
                        </>
                      )}

                      <div className="space-y-3 relative z-10">
                        {/* Top Header of Card */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <h2
                              className={`text-lg font-black font-display transition leading-snug ${
                                hasCoverImage
                                  ? "text-[#fefefe] group-hover:text-[#deab65] drop-shadow-sm"
                                  : "text-[#2b1a10] group-hover:text-[#deab65]"
                              }`}
                            >
                              {book.titleArabic}
                            </h2>
                            <p
                              className={`text-xs font-bold ${
                                hasCoverImage ? "text-[#e6dccf]/90" : "text-[#7f6a55]"
                              }`}
                            >
                              {book.authorArabic} ({book.authorDeath})
                            </p>
                          </div>

                          {/* Professional Glassmorphic Download Button with Capsule Progress Fill */}
                          <div className="shrink-0 self-start pt-0.5">
                            {isDownloaded ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIndexBookToggle(book);
                                }}
                                className={`px-3 h-7 rounded-full text-[10px] font-extrabold cursor-pointer transition-all duration-300 flex items-center gap-1 border border-[#deab65]/50 backdrop-blur-md shadow-xs active:scale-95 ${
                                  hasCoverImage
                                    ? "bg-[#deab65]/25 text-[#fdfcfb] hover:bg-[#deab65]/35"
                                    : "bg-[#deab65]/15 text-[#2b1a10] hover:bg-[#deab65]/25"
                                }`}
                                title="محمل ومتاح بدون إنترنت - اضغط للحذف"
                              >
                                <Check className="w-2.5 h-2.5 text-[#deab65] stroke-[3]" />
                                <span className="text-[9.5px]">أوفلاين</span>
                              </button>
                            ) : isDownloadingThisBook ? (
                              <div
                                className="relative overflow-hidden w-[84px] h-7 rounded-full border border-[#deab65]/60 bg-white/85 backdrop-blur-md shadow-sm flex items-center justify-center cursor-default"
                                title={`جاري التحميل... ${currentPct}%`}
                              >
                                {/* Progress Fill inside Capsule (RTL width fill from right) */}
                                <div
                                  className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#deab65] to-[#c4904a] transition-all duration-300 ease-out opacity-85"
                                  style={{ width: `${currentPct}%` }}
                                />
                                {/* Percentage & Loading Icon */}
                                <div className="relative z-10 flex items-center justify-center gap-1 text-[10px] font-black text-[#2b1a10]">
                                  <SakeenahLineSpinner size={32} color="#2b1a10" label="جارٍ تنزيل الكتاب" className="shrink-0" />
                                  <span className="tabular-nums font-mono">{currentPct}%</span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIndexBookToggle(book);
                                }}
                                className={`px-3 h-7 rounded-full text-[10px] font-extrabold cursor-pointer transition-all duration-300 flex items-center gap-1 border border-[#deab65]/40 backdrop-blur-md shadow-xs active:scale-95 ${
                                  hasCoverImage
                                    ? "bg-black/40 text-[#fdfcfb] hover:bg-[#deab65]/30 hover:border-[#deab65]/70"
                                    : "bg-white/50 text-[#8a6a3d] hover:bg-[#deab65]/15 hover:border-[#deab65]/60"
                                }`}
                                title="تحميل للقراءة والبحث بدون إنترنت"
                              >
                                <Download className="w-2.5 h-2.5 text-[#deab65]" />
                                <span className="text-[9.5px]">تنزيل</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p
                          className={`text-xs leading-relaxed line-clamp-3 font-serif ${
                            hasCoverImage ? "text-[#f2ebe1]/90" : "text-[#524336]"
                          }`}
                        >
                          {book.description}
                        </p>

                        {/* Stats Badges */}
                        <div className="flex items-center gap-2 pt-1">
                          <div
                            className={`px-3 py-1 text-[11px] font-bold rounded-full backdrop-blur-md ${
                              hasCoverImage
                                ? "bg-white/15 text-[#fdfcfb] border border-white/20"
                                : "cut-crystal-capsule text-[#2b1a10]"
                            }`}
                          >
                            {book.hadithsCount.toLocaleString("ar-EG")} حديثًا
                          </div>
                          <div
                            className={`px-3 py-1 text-[11px] font-bold rounded-full backdrop-blur-md ${
                              hasCoverImage
                                ? "bg-white/10 text-[#e6dccf] border border-white/15"
                                : "cut-crystal-capsule text-[#524336]"
                            }`}
                          >
                            {book.chaptersCount} بابًا
                          </div>
                        </div>
                      </div>

                      {/* Footer Action Button */}
                      <div
                        className={`pt-4 mt-4 relative z-10 ${
                          hasCoverImage
                            ? "border-t border-white/15"
                            : "border-t border-[#2b1a10]/10"
                        }`}
                      >
                        <button
                          onClick={() => handleOpenBook(book)}
                          className="w-full py-2.5 px-4 cut-crystal-capsule-gold text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <BookText className="w-4 h-4 text-[#2b1a10]" />
                          <span>فتح وتصفح الكتاب</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VIEW 2: BOOK READER VIEW (تصفح وتدقيق أحاديث الكتاب)
            ════════════════════════════════════════════════════════════════ */}
        {viewMode === "book_reader" && selectedBook && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Header Toolbar Card */}
            <div className="p-5 cut-crystal-panel rounded-[26px] space-y-4 relative z-30">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Book Title & Author Info */}
                <div className="space-y-1 text-right flex-1 min-w-0">
                  <h2 className="text-2xl font-black text-[#2b1a10] font-display tracking-tight leading-tight">
                    {selectedBook.titleArabic}
                  </h2>
                  <p className="text-[13px] font-bold text-[#7f6a55]/90">
                    {selectedBook.authorArabic}
                  </p>
                </div>

                {/* Left side actions: Search Bar & Jump to Hadith */}
                <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
                  {/* Reader Search input (Only visible when not on all chapters) */}
                  {activeChapterId !== "all" && (
                    <form onSubmit={handleReaderSearchSubmit} className="relative w-full sm:w-60">
                      <div className="cut-crystal-input flex items-center px-3 py-1.5">
                        <Search className="w-3.5 h-3.5 text-[#7f6a55] ml-2 shrink-0" />
                        <input
                          type="text"
                          value={readerSearch}
                          onChange={(e) => setReaderSearch(e.target.value)}
                          placeholder="بحث داخل الباب الحالي..."
                          className="w-full bg-transparent border-none text-xs text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none"
                        />
                      </div>
                    </form>
                  )}

                  {/* Jump to Hadith Number Form (Only visible when on all chapters) */}
                  {activeChapterId === "all" && (
                    <form onSubmit={handleJumpToHadith} className="flex items-center gap-1.5">
                      <div className="cut-crystal-input flex items-center px-3 py-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={jumpHadithNum}
                          onChange={(e) => setJumpHadithNum(e.target.value)}
                          placeholder="رقم الحديث..."
                          className="w-20 bg-transparent border-none text-xs text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none text-center"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 cut-crystal-capsule-gold text-xs font-bold transition cursor-pointer"
                      >
                        انتقال
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Lower Section: Active chapter detail & Index trigger with Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#2b1a10]/10">
                <div className="text-xs text-[#7f6a55] font-bold flex items-center gap-1">
                  <span className="text-[#deab65] font-extrabold">الباب الحالي:</span>
                  <span className="text-[#2b1a10]">
                    {activeChapterId === "all"
                      ? "جميع الأبواب"
                      : chapters.find((c) => c.id === activeChapterId)?.title || `الباب رقم ${activeChapterId}`}
                  </span>
                </div>

                {/* Compact Index Trigger Button with Dropdown Card */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowChapterDrawer(!showChapterDrawer)}
                    className="px-3.5 py-2 cut-crystal-capsule bg-[#deab65]/10 hover:bg-[#deab65]/20 text-[12.5px] font-bold text-[#2b1a10] border border-[#deab65]/35 flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-3xs"
                    title="فتح فهرس الأبواب"
                  >
                    <List className="w-4 h-4 text-[#8a6a3d]" />
                    <span className="text-[#8a6a3d]">الفهرس:</span>
                    <span className="font-extrabold max-w-[120px] sm:max-w-[180px] truncate">
                      {activeChapterId === "all"
                        ? "جميع الأبواب"
                        : chapters.find((c) => c.id === activeChapterId)?.title || `الباب رقم ${activeChapterId}`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#8a6a3d]/80" />
                  </button>

                  {/* Dropdown Card (البطاقة المنسدلة للفهرس) */}
                  <AnimatePresence>
                    {showChapterDrawer && (
                      <>
                        <div
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={() => setShowChapterDrawer(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.97 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute right-0 top-full mt-2 w-[290px] sm:w-[340px] bg-[#fdfcfb]/95 backdrop-blur-xl rounded-[24px] border border-[#e6dccf] shadow-[0_12px_28px_rgba(43,26,16,0.12)] z-50 overflow-hidden flex flex-col max-h-[380px] text-right"
                        >
                          {/* Search bar inside Dropdown */}
                          <div className="p-3 border-b border-[#2b1a10]/10 bg-[#fbf8f3]/85">
                            <div className="cut-crystal-input flex items-center px-2.5 py-1">
                              <Search className="w-3.5 h-3.5 text-[#7f6a55] ml-1.5 shrink-0" />
                              <input
                                type="text"
                                value={chapterSearchQuery}
                                onChange={(e) => setChapterSearchQuery(e.target.value)}
                                placeholder="تصفية أبواب الفهرس..."
                                className="w-full bg-transparent border-none text-[12px] text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none"
                              />
                              {chapterSearchQuery && (
                                <button
                                  onClick={() => setChapterSearchQuery("")}
                                  className="text-[#7f6a55] hover:text-[#2b1a10] mr-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* List of Chapters with scrollbar */}
                          <div className="flex-1 overflow-y-auto p-2 space-y-1 player-hide-scrollbar max-h-[300px]">
                            {/* All Chapters option */}
                            {!chapterSearchQuery && (
                              <button
                                onClick={() => {
                                  handleChapterSelect("all");
                                  setShowChapterDrawer(false);
                                }}
                                className={`w-full p-2.5 rounded-[14px] text-right text-xs font-bold transition flex items-center justify-between border ${
                                  activeChapterId === "all"
                                    ? "bg-[#deab65]/15 text-[#8a6a3d] border-[#deab65]/30"
                                    : "hover:bg-[#e8dfd4]/45 text-[#2b1a10] border-transparent"
                                }`}
                              >
                                <span>عرض جميع الأبواب</span>
                                <Check className={`w-3.5 h-3.5 ${activeChapterId === "all" ? "opacity-100 text-[#deab65]" : "opacity-0"}`} />
                              </button>
                            )}

                            {loadingChapters ? (
                              <div className="py-8 flex items-center justify-center gap-2 text-xs font-bold text-[#7f6a55]">
                                <SakeenahLineSpinner size={32} color="#deab65" label="جارٍ تحميل فهرس الأبواب" />
                                <span>جاري تحميل الفهرس...</span>
                              </div>
                            ) : (
                              chapters
                                .filter((ch) =>
                                  chapterSearchQuery.trim()
                                    ? ch.title.toLowerCase().includes(chapterSearchQuery.trim().toLowerCase())
                                    : true
                                )
                                .map((ch) => (
                                  <button
                                    key={ch.id}
                                    onClick={() => {
                                      handleChapterSelect(ch.id);
                                      setShowChapterDrawer(false);
                                    }}
                                    className={`w-full p-2.5 rounded-[14px] text-right text-xs font-bold transition flex items-center justify-between border ${
                                      activeChapterId === ch.id
                                        ? "bg-[#deab65]/15 text-[#8a6a3d] border-[#deab65]/30"
                                        : "hover:bg-[#e8dfd4]/45 text-[#2b1a10] border-transparent"
                                    }`}
                                  >
                                    <div className="space-y-0.5 max-w-[85%] text-right">
                                      <span className="block truncate">{ch.title}</span>
                                      {ch.hadithCount !== undefined && ch.hadithCount > 0 && (
                                        <span className={`text-[9.5px] font-normal ${activeChapterId === ch.id ? "text-[#deab65]" : "text-[#7f6a55]"}`}>
                                          ({ch.hadithCount} أحاديث)
                                        </span>
                                      )}
                                    </div>
                                    <Check className={`w-3.5 h-3.5 shrink-0 ${activeChapterId === ch.id ? "opacity-100 text-[#deab65]" : "opacity-0"}`} />
                                  </button>
                                ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Hadiths Content Loading & Error */}
            {loadingHadiths && (
              <div className="py-20 text-center space-y-3">
                <SakeenahLineSpinner size={40} color="#deab65" label="جارٍ تحميل الأحاديث" className="mx-auto" />
                <p className="text-sm font-bold text-[#7f6a55]">جاري تحميل الأحاديث الشريفة...</p>
              </div>
            )}

            {hadithsError && (
              <div className="p-6 cut-crystal-satin border border-rose-300 text-rose-900 text-center space-y-3">
                <p className="text-sm font-bold">{hadithsError}</p>
                <button
                  onClick={() => fetchHadiths(selectedBook.id, activeChapterId, page, readerSearch)}
                  className="px-4 py-2 cut-crystal-capsule bg-rose-700 text-white text-xs font-bold transition inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            )}

            {/* Hadiths Cards List */}
            {!loadingHadiths && !hadithsError && (
              <div className="space-y-4">
                {hadiths.length === 0 ? (
                  <div className="py-16 cut-crystal-satin text-center space-y-2 rounded-[26px]">
                    <p className="text-sm font-bold text-[#7f6a55]">لم يتم العثور على أحاديث تطابق بحثك.</p>
                    <button
                      onClick={() => {
                        setReaderSearch("");
                        setActiveChapterId("all");
                        fetchHadiths(selectedBook.id, "all", 1, "");
                      }}
                      className="px-4 py-1.5 cut-crystal-capsule bg-[#2b1a10] text-[#fdfcfb] text-xs font-bold"
                    >
                      إعادة ضبط
                    </button>
                  </div>
                ) : (
                  hadiths.map((hadith, idx) => {
                    const bookmarked = isBookmarked(hadith);
                    const isSpeaking = speakingHadithNum === hadith.hadithnumber;
                    const isCopied = copiedId === `${hadith.bookId}_${hadith.hadithnumber}`;

                    return (
                      <motion.div
                        key={`${hadith.bookId}_${hadith.hadithnumber}_${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className="cut-crystal-satin rounded-[26px] p-5 md:p-6 space-y-4"
                      >
                        {/* Hadith Header */}
                        <div className="flex items-start justify-between gap-3 border-b border-[#2b1a10]/10 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full bg-[#2b1a10] text-[#fdfcfb] text-xs font-extrabold shadow-xs">
                              حديث رقم: [{hadith.hadithnumber}]
                            </span>
                            <span className="text-xs font-bold text-[#524336] px-3 py-1 cut-crystal-capsule">
                              {hadith.chapterTitle}
                            </span>
                            {hadith.grade && (
                              <span
                                className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${
                                  hadith.grade.includes("صحيح") || hadith.grade.includes("Sahih")
                                    ? "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40"
                                    : "bg-amber-950/10 text-amber-900 border-amber-800/30"
                                }`}
                              >
                                {localizeHadithGrade(hadith.grade)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Bookmark Toggle */}
                            <button
                              onClick={() => saveBookmarkToggle(hadith)}
                              className={`p-2 transition rounded-full ${
                                bookmarked
                                  ? "cut-crystal-capsule-dark bg-[#deab65] text-[#2b1a10]"
                                  : "cut-crystal-capsule text-[#524336] hover:text-[#2b1a10]"
                              }`}
                              title={bookmarked ? "محفوظ في المفضلة" : "حفظ الحديث"}
                            >
                              <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-[#2b1a10]" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Hadith Text with Quran/Traditional Typography */}
                        <div
                          style={{ fontSize: `${fontSize}px` }}
                          className="font-serif text-[#1c120a] leading-[2.2] text-justify font-normal tracking-tight px-1"
                        >
                          {hadith.text?.trim() ? (
                            hadith.text
                          ) : (
                            <span className="text-sm font-sans text-[#7f6a55] leading-loose">
                              هذا السجل موجود في الإصدار العربي الموحّد للمصدر، لكن النص العربي غير متوفر له في ملف المصدر الحالي.
                            </span>
                          )}
                        </div>

                        {/* Hadith Action Bar */}
                        <div className="pt-3 border-t border-[#2b1a10]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                          {/* Left: Standard Actions */}
                          <div className="flex items-center gap-1.5">
                            {/* Speak button */}
                            <button
                              onClick={() => handleSpeechHadith(hadith)}
                              className={`p-2.5 cut-crystal-capsule transition cursor-pointer flex items-center justify-center text-[#524336] hover:text-[#2b1a10] ${
                                isSpeaking ? "bg-rose-50 text-rose-700 border-rose-200" : ""
                              }`}
                              title={isSpeaking ? "إيقاف القراءة الصوتية" : "قراءة صوتية للحديث"}
                            >
                              {isSpeaking ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-[#deab65]" />}
                            </button>

                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyHadith(hadith)}
                              className={`p-2.5 cut-crystal-capsule transition cursor-pointer flex items-center justify-center text-[#524336] hover:text-[#2b1a10] ${
                                isCopied ? "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40" : ""
                              }`}
                              title="نسخ الحديث الشريف"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-[#deab65]" /> : <Copy className="w-4 h-4 text-[#deab65]" />}
                            </button>

                            {/* Share button */}
                            <button
                              onClick={() => handleShareHadith(hadith)}
                              className="p-2.5 cut-crystal-capsule text-[#524336] hover:text-[#2b1a10] transition cursor-pointer flex items-center justify-center"
                              title="مشاركة الحديث"
                            >
                              <Share2 className="w-4 h-4 text-[#deab65]" />
                            </button>

                            {/* Report Typo / Note button */}
                            <button
                              onClick={() => setReportingHadith(hadith)}
                              className="px-3 py-1.5 cut-crystal-capsule text-rose-800 hover:bg-rose-50/50 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
                              title="الإبلاغ عن تصحيح في التشكيل أو النص"
                            >
                              <Flag className="w-3.5 h-3.5 text-rose-600" />
                              <span className="hidden sm:inline">بلاغ تصحيح</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {/* Reader Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 pt-6 pb-4">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="px-4 py-2 cut-crystal-capsule text-xs font-bold text-[#2b1a10] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>الصفحة السابقة</span>
                    </button>

                    <div className="text-xs font-extrabold text-[#7f6a55]">
                      صفحة {page} من {totalPages}
                    </div>

                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className="px-4 py-2 cut-crystal-capsule text-xs font-bold text-[#2b1a10] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                    >
                      <span>الصفحة التالية</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VIEW 3: BOOKMARKS VIEW (المحفوظات)
            ════════════════════════════════════════════════════════════════ */}
        {viewMode === "bookmarks" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-4 cut-crystal-panel rounded-[26px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-[#deab65]" />
                <h2 className="text-base font-extrabold text-[#2b1a10]">قائمة الأحاديث المحفوظة</h2>
              </div>
              <span className="text-xs font-bold text-[#7f6a55]">{bookmarks.length} حديثًا محفوظًا</span>
            </div>

            {bookmarks.length === 0 ? (
              <div className="py-20 text-center cut-crystal-satin rounded-[26px] space-y-3">
                <Bookmark className="w-12 h-12 text-[#7f6a55]/30 mx-auto" />
                <p className="text-sm font-bold text-[#7f6a55]">لم تقم بحفظ أي أحاديث بعد.</p>
                <button
                  onClick={() => setViewMode("library")}
                  className="px-4 py-2 cut-crystal-capsule bg-[#2b1a10] text-[#fdfcfb] text-xs font-bold"
                >
                  تصفح المكتبة
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-4 cut-crystal-satin rounded-[22px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#2b1a10] text-[#fdfcfb] text-[10px] font-bold">
                          {bm.bookTitle}
                        </span>
                        <span className="text-xs font-bold text-[#7f6a55]">حديث رقم [{bm.hadithnumber}]</span>
                      </div>
                      <p className="text-xs font-serif text-[#2b1a10] line-clamp-2">{bm.textSnippet}</p>
                      <p className="text-[10px] text-[#7f6a55]">{bm.chapterTitle}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          const bk = books.find((b) => b.id === bm.bookId);
                          if (bk) {
                            handleOpenBook(bk, "all", 1);
                            setReaderSearch(bm.hadithnumber.toString());
                          }
                        }}
                        className="px-3.5 py-1.5 cut-crystal-capsule-gold text-xs font-bold transition cursor-pointer"
                      >
                        الانتقال للحديث
                      </button>
                      <button
                        onClick={() => {
                          const updated = bookmarks.filter((b) => b.id !== bm.id);
                          setBookmarks(updated);
                          localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
                        }}
                        className="p-2 cut-crystal-capsule text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        title="حذف من المحفوظات"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VIEW 4: USER TYPO REPORTS VIEW (سجل ملاحظاتي وبلاغاتي)
            ════════════════════════════════════════════════════════════════ */}
        {viewMode === "reports" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-4 cut-crystal-panel rounded-[26px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-[#deab65]" />
                <h2 className="text-base font-extrabold text-[#2b1a10]">سجل ملاحظاتي وبلاغاتي عن النصوص والتشكيل</h2>
              </div>
              <span className="text-xs font-bold text-[#7f6a55]">{reports.length} بلاغًا مسجلاً</span>
            </div>

            {reports.length === 0 ? (
              <div className="py-20 text-center cut-crystal-satin rounded-[26px] space-y-3">
                <ShieldCheck className="w-12 h-12 text-[#deab65]/40 mx-auto" />
                <p className="text-sm font-bold text-[#7f6a55]">لا توجد ملاحظات أو بلاغات مسجلة لديك حالياً.</p>
                <p className="text-xs text-[#7f6a55]/80 max-w-md mx-auto">
                  يمكنك أثناء تصفح أي حديث النقر على زر "إبلاغ عن تصحيح" لتدوين أي ملحوظة حول التشكيل أو الألفاظ وحفظها.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 cut-crystal-satin rounded-[22px] space-y-2 border border-amber-900/10"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#2b1a10]/10 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#2b1a10] text-[#fdfcfb] text-xs font-bold">
                          {rep.bookTitle}
                        </span>
                        <span className="text-xs font-bold text-[#7f6a55]">حديث رقم [{rep.hadithnumber}]</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100/80 text-amber-900 font-bold border border-amber-300/50">
                          {rep.category}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteReport(rep.id)}
                        className="p-1.5 cut-crystal-capsule text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        title="حذف البلاغ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-bold text-[#2b1a10] leading-relaxed">
                      الملاحظة المدونة: <span className="font-normal text-[#524336]">"{rep.note}"</span>
                    </p>

                    <div className="text-[10px] text-[#7f6a55]/70 flex items-center justify-between pt-1">
                      <span>{rep.chapterTitle}</span>
                      <span>{new Date(rep.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VIEW 5: GLOBAL SEARCH RESULTS VIEW (نتائج البحث الشامل)
            ════════════════════════════════════════════════════════════════ */}
        {viewMode === "search_global" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="p-5 cut-crystal-panel rounded-[26px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#deab65]" />
                  <h2 className="text-lg font-black text-[#2b1a10]">نتائج البحث الشامل</h2>
                </div>
                <p className="text-xs text-[#7f6a55] font-bold">
                  البحث عن: <span className="text-[#2b1a10] font-black font-serif">"{globalSearchQuery}"</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <span className="px-3 py-1.5 rounded-full bg-[#2b1a10] text-[#fdfcfb] text-xs font-bold">
                  {globalSearchResults.length} نتائج
                </span>
                {searchMethod === "offline" && Object.values(downloadStats).some(v => v === true) ? (
                  <span className="px-3 py-1.5 rounded-full bg-[#deab65]/20 text-[#2b1a10] text-[10px] font-black border border-[#deab65]/40 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#deab65]" />
                    <span>محرك أوفلاين ٢٠٠٪</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-[#2b1a10]/5 text-[#7f6a55] text-[10px] font-black border border-[#2b1a10]/10 flex items-center gap-1">
                    <span>بحث سيرفر أونلاين</span>
                  </span>
                )}
              </div>
            </div>

            {loadingGlobalSearch ? (
              <div className="py-24 text-center space-y-4 cut-crystal-satin rounded-[26px]">
                <SakeenahLineSpinner size={40} color="#deab65" label="جارٍ إجراء البحث" className="mx-auto" />
                <p className="text-sm font-bold text-[#7f6a55]">جاري إجراء البحث الفائق في أمهات كتب السنة...</p>
              </div>
            ) : globalSearchResults.length === 0 ? (
              <div className="py-20 text-center cut-crystal-satin rounded-[26px] space-y-4">
                <AlertCircle className="w-12 h-12 text-[#deab65]/40 mx-auto" />
                <p className="text-sm font-bold text-[#2b1a10]">لم نجد أي نتائج مطابقة لعبارة البحث.</p>
                <p className="text-xs text-[#7f6a55] max-w-md mx-auto leading-relaxed text-center">
                  تلميح: جرب كتابة كلمات مفردة أو مرادفات إسلامية (مثل: صلاة، وضوء، غضب، والدين، توبة). خوارزمية محرك البحث قادرة على توسيع مرادفات هذه الكلمات أوفلاين تلقائياً لتغطي عشرات الألفاظ والمشتقات!
                </p>
                <button
                  onClick={() => setViewMode("library")}
                  className="px-5 py-2 cut-crystal-capsule-gold text-xs font-bold transition"
                >
                  العودة لتجربة كلمة أخرى
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {globalSearchResults.map((hadith) => {
                  const isCopied = copiedId === `${hadith.bookId}_${hadith.hadithnumber}`;
                  const isSpeaking = speakingHadithNum === hadith.hadithnumber;

                  return (
                    <div
                      key={`${hadith.bookId}_${hadith.hadithnumber}`}
                      className="p-5 sm:p-6 cut-crystal-satin rounded-[26px] space-y-4 relative overflow-hidden group border border-[#deab65]/10"
                    >
                      {/* Top Header Row of Hadith Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2b1a10]/5 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#2b1a10] text-[#fdfcfb] text-xs font-black">
                            {hadith.bookTitle}
                          </span>
                          <span className="text-xs font-bold text-[#deab65]">حديث رقم [{hadith.hadithnumber}]</span>
                          {hadith.grade && (
                            <span className="px-2 py-0.5 rounded bg-[#deab65]/15 text-[#2b1a10] text-[10px] font-bold border border-[#deab65]/35">
                              درجة الحديث: {localizeHadithGrade(hadith.grade)}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-bold text-[#7f6a55] text-right">
                          {hadith.chapterTitle}
                        </span>
                      </div>

                      {/* Hadith Text Box with Customizable Font Size */}
                      <div className="py-2">
                        <p
                          className="font-serif leading-loose text-right text-[#2b1a10] selection:bg-[#deab65]/20"
                          style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
                        >
                          {hadith.text}
                        </p>
                      </div>

                      {/* Tool Actions Row */}
                      <div className="pt-3 border-t border-[#2b1a10]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Left: Standard Actions */}
                        <div className="flex items-center gap-1.5">
                          {/* Speak button */}
                          <button
                            onClick={() => handleSpeechHadith(hadith)}
                            className={`p-2.5 cut-crystal-capsule transition cursor-pointer flex items-center justify-center text-[#524336] hover:text-[#2b1a10] ${
                              isSpeaking ? "bg-rose-50 text-rose-700 border-rose-200" : ""
                            }`}
                            title={isSpeaking ? "إيقاف القراءة الصوتية" : "قراءة صوتية للحديث"}
                          >
                            {isSpeaking ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-[#deab65]" />}
                          </button>

                          {/* Copy button */}
                          <button
                            onClick={() => handleCopyHadith(hadith)}
                            className={`p-2.5 cut-crystal-capsule transition cursor-pointer flex items-center justify-center text-[#524336] hover:text-[#2b1a10] ${
                              isCopied ? "bg-[#deab65]/20 text-[#2b1a10] border-[#deab65]/40" : ""
                            }`}
                            title="نسخ الحديث الشريف"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-[#deab65]" /> : <Copy className="w-4 h-4 text-[#deab65]" />}
                          </button>

                          {/* Share button */}
                          <button
                            onClick={() => handleShareHadith(hadith)}
                            className="p-2.5 cut-crystal-capsule text-[#524336] hover:text-[#2b1a10] transition cursor-pointer flex items-center justify-center"
                            title="مشاركة الحديث"
                          >
                            <Share2 className="w-4 h-4 text-[#deab65]" />
                          </button>

                          {/* Report Correction button */}
                          <button
                            onClick={() => {
                              setReportingHadith(hadith);
                              setReportNote("");
                              setReportCategory("خطأ في التشكيل أو الإعراب");
                            }}
                            className="px-3 py-1.5 cut-crystal-capsule text-rose-800 hover:bg-rose-50/50 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-bold"
                            title="الإبلاغ عن تصحيح أو ملحوظة"
                          >
                            <Flag className="w-3.5 h-3.5 text-rose-600" />
                            <span className="hidden sm:inline">بلاغ تصحيح</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Return button at bottom */}
                <div className="pt-6 text-center">
                  <button
                    onClick={() => setViewMode("library")}
                    className="px-6 py-3 cut-crystal-capsule-gold text-xs font-black shadow-md cursor-pointer transition active:scale-95 inline-flex items-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4 text-[#2b1a10]" />
                    <span>العودة للمكتبة النبوية</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════
          MODAL 1: TYPO / ERROR REPORT MODAL (الإبلاغ عن تصحيح)
          ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reportingHadith && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#ece7de] cut-crystal-panel rounded-[28px] shadow-2xl overflow-hidden flex flex-col border border-[#deab65]/30"
            >
              <div className="p-4 border-b border-[#2b1a10]/10 flex items-center justify-between bg-[#ece7de]">
                <div className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-amber-700" />
                  <h3 className="text-base font-extrabold text-[#2b1a10]">الإبلاغ عن تصحيح في النص أو التشكيل</h3>
                </div>
                <button
                  onClick={() => setReportingHadith(null)}
                  className="p-1.5 cut-crystal-capsule text-[#2b1a10]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
                <div className="p-3 cut-crystal-satin rounded-[18px] space-y-1">
                  <p className="text-[11px] font-bold text-[#7f6a55]">
                    {reportingHadith.bookTitle} - حديث رقم [{reportingHadith.hadithnumber}]
                  </p>
                  <p className="text-xs font-serif text-[#2b1a10] line-clamp-2">"{reportingHadith.text}"</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2b1a10]">نوع الملاحظة:</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl cut-crystal-input text-xs text-[#2b1a10] focus:outline-none"
                  >
                    <option value="خطأ في التشكيل أو الإعراب">خطأ في التشكيل أو الإعراب</option>
                    <option value="سقط أو زيادة في الكلمات">سقط أو زيادة في الكلمات</option>
                    <option value="خطأ في الترقيم أو اسم الباب">خطأ في الترقيم أو اسم الباب</option>
                    <option value="ملاحظة أخرى">ملاحظة أخرى</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#2b1a10]">تفاصيل الملاحظة أو التصحيح المقترح:</label>
                  <textarea
                    required
                    rows={3}
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="اكتب التشكيل الصحيح أو الملاحظة بالتفصيل..."
                    className="w-full p-3 rounded-xl cut-crystal-input text-xs text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportingHadith(null)}
                    className="px-4 py-2 cut-crystal-capsule text-xs font-bold text-[#7f6a55]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 cut-crystal-capsule-gold text-xs font-bold transition cursor-pointer"
                  >
                    حفظ البلاغ في السجل
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
