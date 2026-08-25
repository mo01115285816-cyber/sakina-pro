import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  Bookmark,
  Clock,
  Download,
  Trash2,
  FolderDown,
  CloudLightning,
  Smartphone,
  BookOpen,
} from "lucide-react";
import type { Reciter, Moshaf } from "@/types/quran";
import { surahNames } from "@/data/surahNames";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { vocalizedSurahNames } from "@/data/vocalizedSurahNames";

interface Props {
  reciter: Reciter;
  moshaf: Moshaf;
  onBack: () => void;
  onPlaySurah: (surahId: number, allSurahs: number[]) => void;
  currentlyPlayingId?: number;
  isPlaying: boolean;
  onTriggerTimer?: () => void;
  onReadSurah?: (surahId: number) => void;
  resolveSurahUrl?: (surahId: number) => string;
  showHeader?: boolean;
}

export default function QuranSurahsScreen({
  reciter,
  moshaf,
  onBack,
  onPlaySurah,
  currentlyPlayingId,
  isPlaying,
  onTriggerTimer,
  onReadSurah,
  resolveSurahUrl,
  showHeader = true,
}: Props) {
  const [downloadedSurahs, setDownloadedSurahs] = useState<number[]>([]);
  const [downloadingSurahs, setDownloadingSurahs] = useState<number[]>([]);
  const [bookmarkedSurahs, setBookmarkedSurahs] = useState<number[]>([]);
  const [surahToDelete, setSurahToDelete] = useState<number | null>(null);

  const surahIds = useMemo(() => {
    return moshaf.surah_list
      .split(",")
      .map(Number)
      .filter((id) => !isNaN(id) && id > 0);
  }, [moshaf]);

  const getSurahUrl = (surahId: number) =>
    resolveSurahUrl?.(surahId) ?? `${moshaf.server}${surahId.toString().padStart(3, "0")}.mp3`;

  useEffect(() => {
    let mounted = true;
    const checkDownloads = async () => {
      const { isAudioDownloaded } = await import("@/utils/audioCache");
      const downloaded: number[] = [];
      for (const id of surahIds) {
        const url = getSurahUrl(id);
        const isDownloaded = await isAudioDownloaded(url);
        if (isDownloaded) {
          downloaded.push(id);
        }
      }
      if (mounted) {
        setDownloadedSurahs(downloaded);
      }
    };
    checkDownloads();
    return () => {
      mounted = false;
    };
  }, [surahIds, moshaf.server]);

  const handleDownloadToggle = async (surahId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getSurahUrl(surahId);

    if (downloadedSurahs.includes(surahId)) {
      setSurahToDelete(surahId);
    } else {
      if (downloadingSurahs.includes(surahId)) return;

      setDownloadingSurahs((prev) => [...prev, surahId]);
      try {
        const { downloadAudioFile } = await import("@/utils/audioCache");
        await downloadAudioFile(url);
        setDownloadedSurahs((prev) => [...prev, surahId]);
      } catch (error) {
        console.error("Failed to download", error);
      } finally {
        setDownloadingSurahs((prev) => prev.filter((id) => id !== surahId));
      }
    }
  };

  const confirmDelete = async () => {
    if (surahToDelete === null) return;
    const url = getSurahUrl(surahToDelete);
    try {
      const { removeAudioFile } = await import("@/utils/audioCache");
      await removeAudioFile(url);
      setDownloadedSurahs((prev) => prev.filter((id) => id !== surahToDelete));
    } catch (error) {
      console.error("Failed to delete", error);
    } finally {
      setSurahToDelete(null);
    }
  };

  const handleBookmarkToggle = (surahId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarkedSurahs.includes(surahId)) {
      setBookmarkedSurahs((prev) => prev.filter((id) => id !== surahId));
    } else {
      setBookmarkedSurahs((prev) => [...prev, surahId]);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#ece7de] text-[#2b1a10] flex flex-col font-sans relative overflow-hidden"
      dir="rtl"
    >
      {/* Background elegant overlay */}
      <div className="absolute top-0 right-0 w-full h-[300px] bg-gradient-to-b from-[#b88a4f]/5 to-transparent pointer-events-none" />

      {/* Floating Header */}
      {showHeader && <div className="fixed top-6 left-6 right-6 flex items-center justify-between z-40 pointer-events-none">
        {/* Left bookmark icon */}
        <button className="w-10 h-10 cut-crystal-capsule rounded-full flex items-center justify-center shadow-md text-[#7f6a55] active:scale-95 transition-transform pointer-events-auto cursor-pointer">
          <Bookmark size={18} />
        </button>

        {/* Right back button */}
        <button
          onClick={onBack}
          className="w-10 h-10 cut-crystal-capsule rounded-full flex items-center justify-center shadow-md text-[#2b1a10] active:scale-95 transition-transform pointer-events-auto cursor-pointer"
        >
          <ChevronRight size={20} />
        </button>
      </div>}

      <div className="flex-1 overflow-y-auto hide-scrollbar pt-24">
        {/* Reciter Info Area */}
        <div className="px-6 pb-6 flex items-center gap-4 z-10 relative">
          {/* Art thumbnail - premium gold gradient */}
          <div className="w-[72px] h-[72px] bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white rounded-[24px] shrink-0 shadow-[0_8px_24px_rgba(184,138,79,0.2)] flex items-center justify-center text-[26px] font-bold font-serif border border-[#c49a62] overflow-hidden">
            {reciter.photoUrl || reciter.photo ? (
              <img
                src={reciter.photoUrl || reciter.photo}
                alt={`صورة ${reciter.name}`}
                width={72}
                height={72}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : reciter.name.trim().charAt(0)}
          </div>
          <div className="text-right flex-1">
            <h2 className="text-[22px] font-bold text-[#2b1a10] leading-tight mb-1">
              {reciter.name}
            </h2>
            <p className="text-[13px] text-[#7f6a55] font-bold">
              {moshaf.name.replace("مرتل", "").trim()} - مرتل
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="px-6 pb-8 flex items-center gap-3 z-10 relative">
          {/* Play All */}
          <button
            onClick={() => {
              if (surahIds.length > 0) {
                onPlaySurah(surahIds[0], surahIds);
              }
            }}
            className="flex-1 bg-gradient-to-r from-[#deab65] to-[#b88a4f] hover:opacity-95 text-white py-3.5 rounded-full font-bold text-[14px] shadow-[0_8px_24px_rgba(184,138,79,0.25)] transition-opacity active:scale-[0.98] text-center"
          >
            تشغيل الكل
          </button>
          {/* Timer play */}
          <button
            onClick={onTriggerTimer}
            className="flex-1 cut-crystal-capsule text-[#b88a4f] py-3.5 rounded-full flex items-center justify-center gap-2 font-bold text-[14px] transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <Clock size={16} />
            <span>مع مؤقت</span>
          </button>
        </div>

        {/* Surahs List (Beautiful Cards) */}
        <div className="px-6 pb-36 relative z-0 space-y-3">
          {surahIds.map((surahId) => {
            const isCurrentPlaying = currentlyPlayingId === surahId;
            const isDownloaded = downloadedSurahs.includes(surahId);
            const isDownloading = downloadingSurahs.includes(surahId);
            const isBookmarked = bookmarkedSurahs.includes(surahId);

            return (
              <div
                key={surahId}
                onClick={() => onPlaySurah(surahId, surahIds)}
                className={`w-full h-[60px] md:h-[64px] rounded-full px-5 md:px-6 flex items-center justify-between group active:scale-[0.99] transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isCurrentPlaying
                    ? "bg-[#f5ebd6]/90 border border-[#c49a62] shadow-md"
                    : "cut-crystal-panel hover:bg-[#f5ebd6]/30 shadow-sm"
                }`}
              >
                {/* Right side: Equalizer / Star Ornament / Surah Name */}
                <div className="flex items-center gap-2 md:gap-2.5 min-w-0 relative z-10 flex-1">
                  <div className="relative w-[34px] h-[34px] flex items-center justify-center shrink-0">
                    {isCurrentPlaying ? (
                      <div className="w-full h-full rounded-full bg-[#b88a4f] flex items-center justify-center shadow-sm">
                        <div
                          className="flex items-center gap-0.5 h-3.5 shrink-0"
                          dir="ltr"
                        >
                          <span
                            className={`w-0.5 bg-white rounded-full origin-bottom ${isPlaying ? "animate-[bounce_0.8s_infinite_100ms]" : "h-1"}`}
                            style={{ height: isPlaying ? "100%" : "3px" }}
                          />
                          <span
                            className={`w-0.5 bg-white rounded-full origin-bottom ${isPlaying ? "animate-[bounce_0.8s_infinite_300ms]" : "h-2"}`}
                            style={{ height: isPlaying ? "60%" : "8px" }}
                          />
                          <span
                            className={`w-0.5 bg-white rounded-full origin-bottom ${isPlaying ? "animate-[bounce_0.8s_infinite_500ms]" : "h-1.2"}`}
                            style={{ height: isPlaying ? "80%" : "5px" }}
                          />
                        </div>
                      </div>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-full h-full fill-none stroke-[#b88a4f] transition-transform duration-500 group-hover:rotate-[45deg]"
                        strokeWidth="1.2"
                      >
                        {/* Outer 8-pointed star */}
                        <path d="M12 2 L15 5 L19 5 L19 9 L22 12 L19 15 L19 19 L15 19 L12 22 L9 19 L5 19 L5 15 L2 12 L5 9 L5 5 L9 5 Z" />
                        {/* Inner 8-pointed star */}
                        <path
                          d="M12 5 L14.1 7.1 L17 7.1 L17 10 L19.1 12 L17 14.1 L17 17 L14.1 17 L12 19.1 L9.9 17 L7 17 L7 14.1 L4.9 12 L7 9.9 L7 7.1 L9.9 7.1 Z"
                          strokeWidth="0.9"
                        />
                        {/* Inner circle */}
                        <circle cx="12" cy="12" r="3" strokeWidth="0.8" />
                        {/* Center solid dot */}
                        <circle
                          cx="12"
                          cy="12"
                          r="1"
                          className="fill-[#b88a4f]"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex flex-col text-right truncate">
                    <span
                      className={`font-display font-bold text-[18px] md:text-[20px] transition-colors leading-none pt-1 select-none whitespace-nowrap truncate ${
                        isCurrentPlaying
                          ? "text-[#b88a4f]"
                          : "text-[#2b1a10] group-hover:text-[#b88a4f]"
                      }`}
                    >
                      {vocalizedSurahNames[surahId] ||
                        `سُورَةُ ${surahNames[surahId]}`}
                    </span>
                    <span className="text-[8px] md:text-[8.5px] text-[#7f6a55] font-bold mt-1 font-sans">
                      {isDownloaded
                        ? "متاحة بدون إنترنت"
                        : "تتطلب اتصال بالإنترنت"}
                    </span>
                  </div>
                </div>

                {/* Left side: Download and Bookmark icons */}
                <div
                  className="flex items-center gap-1.5 md:gap-2 relative z-10 shrink-0 ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onReadSurah) onReadSurah(surahId);
                    }}
                    className="w-8.5 h-8.5 flex items-center justify-center rounded-full text-[#2b1a10] bg-[#2b1a10]/5 hover:bg-[#2b1a10]/10 active:scale-95 transition-all"
                    title="اقرأ وتدبر الآيات"
                  >
                    <BookOpen size={15} strokeWidth={2.2} />
                  </button>

                  <button
                    onClick={(e) => handleBookmarkToggle(surahId, e)}
                    className={`w-8.5 h-8.5 flex items-center justify-center rounded-full active:scale-95 transition-all ${
                      isBookmarked
                        ? "text-[#b88a4f] bg-[#b88a4f]/10"
                        : "text-[#7f6a55] hover:bg-[#b88a4f]/5"
                    }`}
                  >
                    <Bookmark
                      size={15}
                      fill={isBookmarked ? "currentColor" : "none"}
                      strokeWidth={2.2}
                    />
                  </button>

                  <button
                    onClick={(e) => handleDownloadToggle(surahId, e)}
                    disabled={isDownloading}
                    className={`w-8.5 h-8.5 flex items-center justify-center rounded-full active:scale-95 transition-all ${
                      isDownloaded
                        ? "text-[#b88a4f] bg-[#b88a4f]/10 hover:bg-[#b88a4f]/20"
                        : isDownloading
                          ? "text-[#b88a4f] bg-transparent"
                          : "text-[#7f6a55] hover:bg-[#b88a4f]/5"
                    }`}
                  >
                    {isDownloading ? (
                      <SakeenahLineSpinner size={16} color="#b88a4f" label="جارٍ تنزيل السورة" />
                    ) : isDownloaded ? (
                      <Smartphone size={15} strokeWidth={2.2} />
                    ) : (
                      <Download size={15} strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {surahToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSurahToDelete(null)}
              className="absolute inset-0 bg-[#2b1a10]/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[320px] cut-crystal-panel rounded-[32px] p-6 shadow-2xl text-center overflow-hidden"
            >
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 size={24} strokeWidth={1.5} />
              </div>

              <h3 className="text-[18px] font-bold text-[#2b1a10] mb-2">
                حذف التلاوة المحلية
              </h3>
              <p className="text-[13px] text-[#7f6a55] font-medium leading-relaxed mb-6 px-2">
                سيتم حذف الملف من جهازك. ستحتاج إلى اتصال بالإنترنت للاستماع
                إليها مجدداً.
              </p>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setSurahToDelete(null)}
                  className="flex-1 bg-[#f7f2ea] hover:bg-[#e8dfd4] text-[#2b1a10] font-bold text-[14px] py-3 rounded-full transition-colors border border-[#e6dccf]"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-[14px] py-3 rounded-full transition-colors shadow-sm"
                >
                  تأكيد الحذف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
