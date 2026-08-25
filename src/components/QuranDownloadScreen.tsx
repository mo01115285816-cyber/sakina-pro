import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Download } from "lucide-react";
import { QuranOfflineService } from "@/services/QuranOfflineService";
import { QcfFontStorage } from "@/services/QcfFontStorage";
import { publicAssetUrl } from "@/utils/publicAssetUrl";

interface Props {
  onClose: () => void;
  onDownloaded: () => void;
}

function getDownloadStage(progress: number, rawStatus: string): string {
  if (progress >= 100) return "اكتمل تجهيز المصحف والتفسير";
  if (progress >= 85) {
    return rawStatus.includes("خط") || rawStatus.includes("تجهيز")
      ? "جاري تجهيز المصحف للعمل دون اتصال"
      : "جاري إنهاء تنزيل الملفات";
  }
  if (rawStatus.includes("تفسير")) return "جاري تنزيل تفسير ابن كثير";
  return "جاري تنزيل المصحف";
}

export default function QuranDownloadScreen({ onClose, onDownloaded }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const startDownload = async () => {
    setIsDownloading(true);
    setProgress(0);
    setStatusText("جاري تجهيز التنزيل");
    try {
      // المرحلة الأولى: المصحف ثم ابن كثير — 0% إلى 85% تقريبًا
      await QuranOfflineService.downloadQuran((percent, status) => {
        setProgress(Math.floor(percent * 0.85));
        setStatusText(status);
      });

      // المرحلة الثانية: تجهيز خطوط QCF على الأجهزة الأصلية — 85% إلى 100%
      const isAlreadyExtracted = await QcfFontStorage.isExtracted();
      if (!isAlreadyExtracted) {
        await QcfFontStorage.extractFonts((fontPercent, fontStatus) => {
          setProgress(85 + Math.floor(fontPercent * 0.15));
          setStatusText(fontStatus);
        });
      } else {
        setProgress(100);
        setStatusText("اكتمل تجهيز المصحف والتفسير");
      }

      window.setTimeout(() => {
        onDownloaded();
      }, 500);
    } catch (err) {
      console.error("Failed to download Quran and tafsir", err);
      setIsDownloading(false);
      setStatusText("تعذر إتمام التنزيل. تحقق من الاتصال وحاول مرة أخرى.");
    }
  };

  const isError = !isDownloading && statusText.startsWith("تعذر");
  const stageText = isDownloading
    ? getDownloadStage(progress, statusText)
    : isError
      ? statusText
      : "سيتم تنزيل المصحف وتفسير ابن كثير للعمل دون اتصال";

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center overflow-hidden bg-[#ece7de] font-sans text-[#2b1a10]"
      dir="rtl"
    >
      <button
        onClick={onClose}
        aria-label="رجوع"
        className="cut-crystal-capsule fixed left-5 right-auto top-5 z-[60] grid h-10 w-10 place-items-center text-[#2b1a10] shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45"
        style={{
          left: "calc(20px + env(safe-area-inset-left))",
          right: "auto",
          top: "calc(20px + env(safe-area-inset-top))",
        }}
      >
        <ChevronRight size={20} strokeWidth={1.8} />
      </button>

      <main className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center px-5 pb-24 pt-20">
        <div className="relative mb-7 flex h-[min(58vw,280px)] w-[min(58vw,280px)] max-w-[280px] items-center justify-center">
          {isDownloading && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-2 z-0 h-[calc(100%-1rem)] w-[calc(100%-1rem)] -rotate-90 overflow-visible"
              viewBox="0 0 264 264"
            >
              <motion.circle
                cx="132"
                cy="132"
                r="129"
                pathLength={1}
                fill="none"
                stroke="#b88a4f"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="1"
                animate={{ strokeDashoffset: 1 - progress / 100 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                style={{ filter: "drop-shadow(0 2px 5px rgba(184,138,79,0.28))" }}
              />
            </svg>
          )}

          <img
            src={publicAssetUrl("images/quran-circle.png")}
            alt="القرآن الكريم"
            className="relative z-10 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain drop-shadow-[0_12px_28px_rgba(43,26,16,0.15)]"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
        </div>

        <section className="flex w-full max-w-[360px] flex-col items-center text-center">
          <h2 className="font-display text-[22px] font-black leading-tight text-[#2b1a10] sm:text-[26px]">
            تنزيل المصحف والتفسير
          </h2>

          <div className="mt-3 flex min-h-[76px] w-full flex-col items-center justify-start">
          <div className="relative h-9 w-full max-w-[320px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stageText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className={`absolute inset-x-0 top-0 flex h-9 items-center justify-center text-[14px] leading-7 ${isError ? "text-[#8f4d3d]" : "text-[#7f6a55]"}`}
              >
                {stageText}
              </motion.p>
            </AnimatePresence>
          </div>
          {isDownloading && (
            <div className="mt-1 flex h-7 items-center justify-center text-[15px] font-bold text-[#b88a4f]" aria-live="polite" aria-atomic="true" dir="ltr">
              <span className="relative inline-flex h-6 min-w-[2ch] items-center justify-center tabular-nums">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={progress}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {progress}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="mr-0.5 inline-flex h-6 items-center" aria-hidden="true">%</span>
            </div>
          )}
        </div>
        </section>
      </main>

      <AnimatePresence>
        {!isDownloading && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="absolute inset-x-0 z-20 flex justify-center px-5"
            style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={startDownload}
              className="cut-crystal-capsule-gold flex h-12 w-full max-w-[320px] items-center justify-center gap-3 px-5 text-[14px] font-black shadow-[0_14px_24px_-16px_rgba(184,138,79,0.55)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_16px_28px_-14px_rgba(184,138,79,0.62)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ece7de] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={18} strokeWidth={2} />
              <span>{isError ? "حاول مرة أخرى" : "تنزيل المصحف والتفسير"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
