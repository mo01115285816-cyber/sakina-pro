import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  X,
  SlidersHorizontal,
  FileText,
  BookOpen,
  ChevronsUpDown,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import type { Reciter, Moshaf } from "@/types/quran";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { getSmartCache, isSmartCacheStale, setSmartCache } from "@/services/smart-cache";
import QuranLiveBroadcast from "./QuranLiveBroadcast";
import { RadioStation } from "@/types/radio";
import type { RadioCaptureState } from "@/services/radioCaptureService";

const RECITERS_CACHE_KEY = "sakina:cache:quran-reciters:v1";
const RECITERS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function getCachedReciters(): Reciter[] | null {
  return getSmartCache<Reciter[]>(RECITERS_CACHE_KEY)?.data ?? null;
}

// Robust offline fallback list of popular reciters to guarantee instant loading and prevent any blank/empty screen
const FALLBACK_RECITERS: Reciter[] = [
  {
    id: 111,
    name: "مشاري العفاسي",
    letter: "م",
    moshaf: [
      {
        id: 1,
        name: "حفص عن عاصم - مرتل",
        server: "https://server8.mp3quran.net/afs/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 118,
    name: "ماهر المعيقلي",
    letter: "م",
    moshaf: [
      {
        id: 2,
        name: "حفص عن عاصم - مرتل",
        server: "https://server12.mp3quran.net/maher/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 54,
    name: "عبد الباسط عبد الصمد",
    letter: "ع",
    moshaf: [
      {
        id: 3,
        name: "حفص عن عاصم - مرتل",
        server: "https://server7.mp3quran.net/basit/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 86,
    name: "محمد صديق المنشاوي",
    letter: "م",
    moshaf: [
      {
        id: 5,
        name: "حفص عن عاصم - مرتل",
        server: "https://server10.mp3quran.net/minsh/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 74,
    name: "محمود خليل الحصري",
    letter: "م",
    moshaf: [
      {
        id: 4,
        name: "حفص عن عاصم - مرتل",
        server: "https://server13.mp3quran.net/husr/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 110,
    name: "ياسر الدوسري",
    letter: "ي",
    moshaf: [
      {
        id: 6,
        name: "حفص عن عاصم - مرتل",
        server: "https://server11.mp3quran.net/yasser/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 104,
    name: "سعد الغامدي",
    letter: "س",
    moshaf: [
      {
        id: 7,
        name: "حفص عن عاصم - مرتل",
        server: "https://server7.mp3quran.net/s_gmd/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 53,
    name: "عبد الرحمن السديس",
    letter: "ع",
    moshaf: [
      {
        id: 8,
        name: "حفص عن عاصم - مرتل",
        server: "https://server11.mp3quran.net/sds/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 61,
    name: "أحمد العجمي",
    letter: "أ",
    moshaf: [
      {
        id: 10,
        name: "حفص عن عاصم - مرتل",
        server: "https://server10.mp3quran.net/ajm/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 98,
    name: "فارس عباد",
    letter: "ف",
    moshaf: [
      {
        id: 11,
        name: "حفص عن عاصم - مرتل",
        server: "https://server8.mp3quran.net/frs_a/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 1,
    name: "إبراهيم الأخضر",
    letter: "إ",
    moshaf: [
      {
        id: 13,
        name: "حفص عن عاصم - مرتل",
        server: "https://server6.mp3quran.net/akdr/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
  {
    id: 48,
    name: "عبد الرشيد صوفي",
    letter: "ع",
    moshaf: [
      {
        id: 14,
        name: "حفص عن عاصم - مرتل",
        server: "https://server9.mp3quran.net/sof_g/",
        surah_total: 114,
        surah_list:
          "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114",
      },
    ],
  },
];

interface Props {
  isActive?: boolean;
  onSelectReciter: (reciter: Reciter, moshaf: Moshaf) => void;

  // Audio Player states for the bottom mini-player
  playingSurahId: number | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenPlayer: () => void;
  onClosePlayer: () => void;
  selectedReciter: Reciter | null;
  selectedMoshaf: Moshaf | null;

  // Live Radio Props
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  currentPlayingRadio: RadioStation | null;
  onPlayRadio: (radio: RadioStation) => void;
  onPauseRadio: () => void;
  radioCaptureState: RadioCaptureState;
  onToggleRadioCapture: () => void;
  radioCaptureNotice: string | null;
  onModeChange?: (mode: "listening" | "reading") => void;
  onOpenPureRecitations: () => void;
}

export default function QuranRecitersScreen({
  isActive = true,
  onSelectReciter,
  playingSurahId,
  isPlaying,
  onTogglePlay,
  onOpenPlayer,
  onClosePlayer,
  selectedReciter: activePlayerReciter,
  selectedMoshaf: activePlayerMoshaf,
  audioRef,
  currentPlayingRadio,
  onPlayRadio,
  onPauseRadio,
  radioCaptureState,
  onToggleRadioCapture,
  radioCaptureNotice,
  onModeChange,
  onOpenPureRecitations,
}: Props) {
  const [reciters, setReciters] = useState<Reciter[]>(() => getCachedReciters() ?? FALLBACK_RECITERS);
  const [isLoading, setIsLoading] = useState(() => !getCachedReciters());

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("الكل");

  // Performance Optimization: Pagination count to prevent rendering lag
  const [visibleCount, setVisibleCount] = useState(40);

  // Reset visible count when search query or filter changes
  useEffect(() => {
    setVisibleCount(40);
  }, [searchQuery, selectedFilter]);

  useEffect(() => {
    if (!isActive) return;
    const cached = getSmartCache<Reciter[]>(RECITERS_CACHE_KEY);
    if (cached && !isSmartCacheStale(cached, RECITERS_CACHE_MAX_AGE_MS)) {
      setIsLoading(false);
      return;
    }

    const fetchReciters = async () => {
      const hasVisibleReciters = reciters.length > 0;
      setIsLoading(!hasVisibleReciters);
      try {
        const res = await fetch(
          "https://www.mp3quran.net/api/v3/reciters?language=ar",
          { cache: "no-store" },
        );
        const data = await res.json();
        if (data && Array.isArray(data.reciters)) {
          setSmartCache(RECITERS_CACHE_KEY, data.reciters);
          setReciters(data.reciters);
        } else {
          console.error("Invalid reciters response format:", data);
        }
      } catch (error) {
        console.error("Error fetching reciters:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReciters();
  }, [isActive]);

  // Get unique moshaf names for the filter sheet
  const filterOptions = useMemo(() => {
    const options = new Set<string>();
    options.add("الكل");
    options.add("عرض القراء الذين لديهم توقيت فقط");

    // Add popular narrations explicitly
    options.add("حفص عن عاصم");
    options.add("ورش عن نافع");

    reciters.forEach((r) => {
      r.moshaf.forEach((m) => {
        options.add(m.name);
      });
    });
    return Array.from(options).slice(0, 15); // limit to a few premium options for sleekness
  }, [reciters]);

  const filteredReciters = useMemo(() => {
    let result = reciters;

    if (searchQuery.trim() !== "") {
      result = result.filter((r) => r.name.includes(searchQuery.trim()));
    }

    if (selectedFilter !== "الكل") {
      if (selectedFilter === "عرض القراء الذين لديهم توقيت فقط") {
        const famousWithTiming = [
          "إبراهيم الأخضر",
          "محمد صديق المنشاوي",
          "محمود خليل الحصري",
          "ماهر المعيقلي",
          "مشاري العفاسي",
        ];
        result = result.filter((r) =>
          famousWithTiming.some((name) => r.name.includes(name)),
        );
      } else {
        result = result.filter((r) =>
          r.moshaf.some((m) => m.name.includes(selectedFilter)),
        );
      }
    }

    return result;
  }, [reciters, searchQuery, selectedFilter]);

  // Helper to get Arabic numbers
  const toArabicWord = (num: number) => {
    if (num === 3) return "٣ روايات متوفرة";
    if (num === 5) return "٥ روايات متوفرة";
    if (num === 2) return "روايتان متوفرتان";
    return `${num} روايات`;
  };

  return (
    <div
      className="min-h-screen bg-[#ece7de] text-[#2b1a10] flex flex-col font-sans relative overflow-hidden"
      dir="rtl"
    >
      {/* Background soft ambient shapes */}
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-[#b88a4f]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-[#deab65]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Global Backdrop for Top Bar Dropdowns */}
      <AnimatePresence>
        {(isModeDropdownOpen || isDropdownOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 cursor-default bg-black/5"
            onClick={() => {
              setIsModeDropdownOpen(false);
              setIsDropdownOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Top Header Bar - Fixed position across states */}
      <div className="fixed top-6 left-6 right-6 h-10 flex flex-row items-center justify-between flex-nowrap z-40 pointer-events-none">
        {/* Right Element (in RTL): Quran Capsule with Apple UI Dropdown */}
        <div className="relative shrink-0 h-10 flex items-center pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setIsModeDropdownOpen((prev) => !prev);
              setIsDropdownOpen(false);
            }}
            className="cut-crystal-capsule px-4.5 h-10 rounded-full shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
          >
            <span className="text-[14px] font-bold text-[#2b1a10] whitespace-nowrap pt-0.5">
              الاستماع
            </span>
            <ChevronDown
              size={14}
              className={`text-[#b88a4f] transition-transform duration-200 ${isModeDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Mode Dropdown */}
          <AnimatePresence>
            {isModeDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "absolute", top: "calc(100% + 8px)", right: 0 }}
                className="w-44 max-w-[calc(100vw-48px)] cut-crystal-panel rounded-[20px] shadow-2xl z-50 overflow-hidden py-1 origin-top-right text-right"
                dir="rtl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsModeDropdownOpen(false);
                    if (onModeChange) onModeChange("listening");
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-4 text-right transition-colors hover:bg-[#e8dfd4]/45 text-[#2b1a10]"
                >
                  <span className="text-[13px] font-bold text-[#b88a4f]">
                    الاستماع
                  </span>
                  <Check size={14} className="text-[#b88a4f] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModeDropdownOpen(false);
                    if (onModeChange) onModeChange("reading");
                  }}
                  className="w-full flex items-center justify-between py-2.5 px-4 text-right transition-colors hover:bg-[#e8dfd4]/45 text-[#2b1a10]"
                >
                  <span className="text-[13px] font-bold">القرآن الكريم</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Left Element: Dropdown Select Pill for "الكل" */}
        <div className="relative shrink-0 h-10 flex items-center pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen((prev) => !prev);
              setIsModeDropdownOpen(false);
            }}
            className="flex items-center gap-2 cut-crystal-capsule px-4 h-10 rounded-full shadow-md transition-all active:scale-95 shrink-0 max-w-[160px]"
          >
            <span className="text-[13.5px] text-[#2b1a10] font-bold whitespace-nowrap pt-0.5 truncate">
              {selectedFilter}
            </span>
            <ChevronsUpDown size={14} className="text-[#b88a4f] shrink-0" />
          </button>

          {/* Elegant Floating Dropdown Menu */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: "absolute", top: "calc(100% + 8px)", left: 0 }}
                className="w-60 max-w-[calc(100vw-48px)] cut-crystal-panel rounded-[22px] shadow-2xl z-50 overflow-hidden text-[#2b1a10] max-h-[250px] overflow-y-auto hide-scrollbar origin-top-left"
                dir="rtl"
              >
                <div className="px-4 py-2 text-[12px] font-bold text-[#7f6a55] border-b border-[#e6dccf]/40 text-right sticky top-0 bg-[#f7f2ea]/95 backdrop-blur-md z-10">
                  اختر رواية أو تصفية
                </div>
                <div className="p-1.5 space-y-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSelectedFilter(option);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-[16px] transition-all duration-150 text-right ${
                        selectedFilter === option
                          ? "bg-[#b88a4f]/10 text-[#b88a4f]"
                          : "hover:bg-[#e8dfd4]/40 text-[#2b1a10] active:scale-[0.98]"
                      }`}
                    >
                      <span className="text-[13.5px] font-bold truncate">
                        {option}
                      </span>
                      {selectedFilter === option && (
                        <Check
                          size={15}
                          className="text-[#b88a4f] shrink-0 mr-2"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reciters List & Main Scrolling Content */}
      <div
        className="flex-1 overflow-y-auto px-6 pb-36 pt-24 hide-scrollbar"
        dir="rtl"
      >
        {/* Live Quran Broadcast Section */}
        <QuranLiveBroadcast
          audioRef={audioRef}
          currentPlayingRadio={currentPlayingRadio}
          isPlayingRadio={currentPlayingRadio !== null && isPlaying}
          onPlayRadio={onPlayRadio}
          onPauseRadio={onPauseRadio}
          radioCaptureState={radioCaptureState}
          onToggleRadioCapture={onToggleRadioCapture}
          radioCaptureNotice={radioCaptureNotice}
        />

        {/* Dedicated entry point for the separate pure recitations screen. */}
        <button
          type="button"
          onClick={onOpenPureRecitations}
          className="w-full mb-4 cut-crystal-panel rounded-[28px] p-4.5 text-right shadow-md border border-[#deab65]/20 transition-all active:scale-[0.99] hover:bg-[#f5ebd6]/45"
          aria-label="فتح صفحة التلاوات النقية"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[17px] bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#b88a4f] mb-1">اختيارات سكينة</p>
              <h2 className="text-[16px] font-bold text-[#2b1a10] leading-tight">التلاوات النقية</h2>
              <p className="text-[11px] text-[#7f6a55] font-bold mt-1 truncate">تسجيلات منتقاة بجودة أفضل من مكتبة سكينة الخاصة</p>
            </div>
            <ChevronLeft size={18} className="text-[#b88a4f] shrink-0" />
          </div>
        </button>

        {isLoading && reciters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <SakeenahLineSpinner size={40} color="#b88a4f" label="جارٍ تحميل قائمة القراء" />
            <p className="text-[14px] text-[#7f6a55] font-bold">
              جاري تحميل قائمة القراء...
            </p>
          </div>
        ) : filteredReciters.length === 0 ? (
          <div className="text-center py-20 text-[#7f6a55] font-bold">
            لا يوجد نتائج متطابقة للبحث
          </div>
        ) : (
          <div className="space-y-3.5">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-2.5 bg-[#b88a4f]/5 border border-[#b88a4f]/10 rounded-2xl text-[12px] text-[#b88a4f] font-bold mb-3 animate-pulse">
                <SakeenahLineSpinner size={14} color="#b88a4f" label="جارٍ تحديث قائمة القراء" />
                <span>جاري تحديث قائمة القراء كاملة...</span>
              </div>
            )}
            {filteredReciters.slice(0, visibleCount).map((reciter) => {
              const displayMoshaf =
                selectedFilter !== "الكل" &&
                selectedFilter !== "عرض القراء الذين لديهم توقيت فقط"
                  ? reciter.moshaf.find((m) =>
                      m.name.includes(selectedFilter),
                    ) || reciter.moshaf[0]
                  : reciter.moshaf[0];

              const isIbrahim = reciter.name.includes("إبراهيم الأخضر");
              const isMinshawi = reciter.name.includes("المنشاوي");
              const isHusary = reciter.name.includes("الحصري");
              const isAyub = reciter.name.includes("أيوب");
              const isAfasy = reciter.name.includes("العفاسي");

              const hasTiming = isIbrahim || isMinshawi || isHusary;
              const narrationsCount = isMinshawi
                ? 3
                : isHusary
                  ? 5
                  : isAyub
                    ? 2
                    : isAfasy
                      ? 2
                      : reciter.moshaf.length;

              return (
                <button
                  key={reciter.id}
                  onClick={() => onSelectReciter(reciter, displayMoshaf)}
                  className="w-full cut-crystal-panel transition-all rounded-[28px] p-4.5 flex items-center justify-between group active:scale-[0.98] duration-200 shadow-md"
                >
                  <div className="flex items-center gap-4">
                    {/* Premium avatar with brand gold/amber gradient */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white flex items-center justify-center shrink-0 shadow-sm border border-[#c49a62]">
                      <span className="text-[20px] font-bold font-serif">
                        {reciter.name.trim().charAt(0)}
                      </span>
                    </div>

                    {/* Reciter texts */}
                    <div className="text-right">
                      <h3 className="text-[17px] font-bold text-[#2b1a10] leading-tight mb-1.5 transition-colors group-hover:text-[#b88a4f]">
                        {reciter.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#7f6a55] font-bold">
                        {/* Display primary narration */}
                        <div className="flex items-center gap-1.5">
                          <FileText size={12} className="text-[#b88a4f]" />
                          <span>
                            {displayMoshaf.name.replace("مرتل", "").trim()} -
                            مرتل
                          </span>
                        </div>

                        {/* Additional dynamic info */}
                        {narrationsCount > 1 && (
                          <div className="flex items-center gap-1 bg-[#b88a4f]/10 px-2 py-0.5 rounded-full text-[10px] text-[#b88a4f] border border-[#b88a4f]/20">
                            <BookOpen size={10} />
                            <span>{toArabicWord(narrationsCount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left chevron indicating forward action */}
                  <ChevronLeft
                    size={18}
                    className="text-[#b88a4f] opacity-80 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all"
                  />
                </button>
              );
            })}

            {filteredReciters.length > visibleCount && (
              <div className="pt-3 pb-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 45)}
                  className="bg-[#f7f2ea] hover:bg-[#e8dfd4] border border-[#e6dccf] text-[#b88a4f] px-6 py-3 rounded-full text-[14px] font-bold transition-all active:scale-95 shadow-sm font-sans"
                >
                  عرض المزيد من القراء ({filteredReciters.length - visibleCount}
                  )
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Morphing Search Bar */}
      <div
        className="fixed bottom-28 left-6 right-6 z-30 pointer-events-none flex justify-start"
        dir="ltr"
      >
        <motion.div
          animate={{
            width: isSearchActive ? "100%" : 56,
            borderRadius: isSearchActive ? 24 : 28,
          }}
          transition={{ type: "spring", damping: 25, stiffness: 250 }}
          className="h-14 cut-crystal-capsule shadow-lg flex items-center overflow-hidden pointer-events-auto relative"
        >
          {/* Left Side (in LTR): Toggle Button (Search -> Close) */}
          <button
            onClick={() => {
              if (isSearchActive) {
                setIsSearchActive(false);
                setSearchQuery("");
              } else {
                setIsSearchActive(true);
              }
            }}
            className="w-14 h-14 shrink-0 flex items-center justify-center transition-colors z-10"
          >
            <AnimatePresence mode="wait">
              {isSearchActive ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X
                    size={20}
                    className="text-[#7f6a55] hover:text-[#2b1a10]"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Search size={20} className="text-[#b88a4f]" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Input field (RTL) */}
          <div
            className={`flex-1 h-full relative flex items-center transition-opacity duration-200 ${isSearchActive ? "opacity-100" : "opacity-0"}`}
            dir="rtl"
          >
            <input
              ref={(el) => {
                if (el && isSearchActive && document.activeElement !== el) {
                  el.focus();
                }
              }}
              type="text"
              placeholder="البحث عن قارئ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-full bg-transparent border-none outline-none text-[15px] font-sans font-bold text-[#2b1a10] placeholder:text-[#7f6a55] px-2 pt-0.5"
              tabIndex={isSearchActive ? 0 : -1}
            />
          </div>

          {/* Right Side: Decorative Search Icon when expanded */}
          <div
            className={`w-12 h-14 shrink-0 flex items-center justify-center transition-opacity duration-200 ${isSearchActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <Search size={18} className="text-[#b88a4f]/50" />
          </div>
        </motion.div>
      </div>

      {/* Floating Mini Player overlay space */}
      <AnimatePresence>
        {playingSurahId !== null &&
          activePlayerReciter &&
          activePlayerMoshaf && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-[420px] pointer-events-auto">
              {/* Handled directly in parent tab wrapper */}
            </div>
          )}
      </AnimatePresence>

      {/* Filter Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-[#2b1a10]/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 cut-crystal-panel rounded-t-[32px] z-50 overflow-hidden flex flex-col max-h-[75vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-[#e6dccf]/60">
                <h3 className="text-[18px] font-bold text-[#2b1a10] w-full text-center pr-8">
                  تصفية حسب
                </h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="w-8 h-8 flex items-center justify-center bg-[#f7f2ea] rounded-full text-[#7f6a55] border border-[#e6dccf]/40 hover:bg-[#e8dfd4] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div
                className="flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-[#e6dccf]/40"
                dir="rtl"
              >
                {filterOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedFilter(option);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between py-4 px-3 rounded-2xl transition-colors ${
                      selectedFilter === option
                        ? "bg-[#b88a4f]/10 text-[#b88a4f]"
                        : "hover:bg-[#f7f2ea]"
                    }`}
                  >
                    <span
                      className={`text-[15px] text-right ${selectedFilter === option ? "font-bold text-[#b88a4f]" : "font-bold text-[#7f6a55]"}`}
                    >
                      {option}
                    </span>
                    {selectedFilter === option && (
                      <Check size={18} className="text-[#b88a4f]" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
