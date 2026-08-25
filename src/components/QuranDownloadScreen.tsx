import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download } from "lucide-react";
import { QuranOfflineService } from "@/services/QuranOfflineService";
import { QcfFontStorage } from "@/services/QcfFontStorage";
import { publicAssetUrl } from "@/utils/publicAssetUrl";

interface Props {
  onClose: () => void;
  onDownloaded: () => void;
}

export default function QuranDownloadScreen({ onClose, onDownloaded }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const startDownload = async () => {
    setIsDownloading(true);
    try {
      // Phase 1: Download Quran data (verses + tafsir) — 0% to 85%
      await QuranOfflineService.downloadQuran((percent, status) => {
        // Map 0-100 of data download to 0-85 of overall progress
        const overallPercent = Math.floor(percent * 0.85);
        setProgress(overallPercent);
        setStatusText(status);
      });

      // Phase 2: Extract QCF fonts on native platforms — 85% to 100%
      // On web, this is a no-op and returns immediately
      const isAlreadyExtracted = await QcfFontStorage.isExtracted();
      if (!isAlreadyExtracted) {
        await QcfFontStorage.extractFonts((fontPercent, fontStatus) => {
          // Map 0-100 of font extraction to 85-100 of overall progress
          const overallPercent = 85 + Math.floor(fontPercent * 0.15);
          setProgress(overallPercent);
          setStatusText(fontStatus);
        });
      } else {
        setProgress(100);
        setStatusText("اكتمل تجهيز المصحف");
      }

      // Give a tiny delay before switching
      setTimeout(() => {
        onDownloaded();
      }, 500);
    } catch (err) {
      console.error("Failed to download Quran", err);
      setIsDownloading(false);
      setStatusText("حدث خطأ أثناء التحميل. يرجى المحاولة مرة أخرى.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center font-[Cairo] bg-gradient-to-b from-[#e6dccf] via-[#ece7de] to-[#fdfcfb] text-[#2b1a10]"
      dir="rtl"
    >
      {/* Close Button at top left */}
      <button 
        onClick={onClose}
        className="absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border border-[#e6dccf] text-[#7f6a55] transition-transform hover:scale-105 active:scale-95 z-10 hover:text-[#b88a4f]"
      >
        <X size={20} strokeWidth={2} />
      </button>

      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 pb-20">

        {/* Central Quran calligraphy image with progress ring hugging it */}
        <div className="relative w-[280px] h-[280px] mb-8 flex items-center justify-center">
          {/* Progress Ring — sits behind the image, hugging its circular edge */}
          {isDownloading && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 z-0 overflow-visible pointer-events-none"
              viewBox="0 0 280 280"
            >
              {/* Track (subtle background ring) */}
              <circle
                cx="140" cy="140" r="136"
                fill="none"
                stroke="rgba(184, 138, 79, 0.12)"
                strokeWidth="4"
              />
              {/* Active progress ring — gradient stroke for premium look */}
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#deab65" />
                  <stop offset="50%" stopColor="#b88a4f" />
                  <stop offset="100%" stopColor="#8a6a3d" />
                </linearGradient>
              </defs>
              <circle
                cx="140" cy="140" r="136"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="854.51"
                strokeDashoffset={854.51 - (854.51 * progress) / 100}
                className="transition-all duration-500 ease-out"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(184, 138, 79, 0.3))' }}
              />
            </svg>
          )}

          {/* Quran calligraphy image — the circle itself (transparent background, preloaded) */}
          <img
            src={publicAssetUrl("images/quran-circle.png")}
            alt="القرآن الكريم"
            className="relative w-[260px] h-[260px] object-contain z-10 drop-shadow-[0_12px_28px_rgba(43,26,16,0.15)]"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Text Details */}
        <div className="flex flex-col items-center text-center">
          <h2 className="text-[26px] font-semibold text-[#2b1a10] mb-1">تنزيل المصحف والتفسير</h2>
          
          <div className="h-8">
            <AnimatePresence mode="wait">
              {isDownloading ? (
                <motion.div 
                  key="downloading"
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1.5 text-[18px] text-[#7f6a55]"
                >
                  <span className="tabular-nums font-medium" dir="ltr">{progress}%</span>
                  <span className="font-medium">مكتمل</span>
                </motion.div>
              ) : (
                <motion.p
                  key="waiting"
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="text-[16px] text-[#7f6a55]"
                >
                  سيتم تنزيل المصحف وتفسير ابن كثير للعمل دون اتصال.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fixed Download Button (Only shows if not downloading) */}
      <AnimatePresence>
        {!isDownloading && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-12 left-0 right-0 px-6 flex justify-center z-20"
          >
              <button
              onClick={startDownload}
              className="w-full max-w-[320px] flex items-center justify-center gap-3 py-3.5 rounded-full bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white font-bold text-[18px] shadow-[0_8px_24px_rgba(184, 138, 79, 0.3)] border border-[#c49a62] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>تنزيل المصحف والتفسير</span>
              <Download size={20} className="opacity-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
