import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Download } from "lucide-react";
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
  if (progress >= 60) return "جاري تنزيل تفسير ابن كثير";
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center overflow-hidden bg-[#ece7de] font-sans text-[#2b1a10]"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -right-32 -top-28 h-80 w-80 rounded-full bg-[#d8b27b]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[#b9a58e]/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:radial-gradient(#2b1a10_0.6px,transparent_0.6px)] [background-size:18px_18px]" />

      <button
        onClick={onClose}
        aria-label="رجوع"
        className="cut-crystal-capsule absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 grid h-10 w-10 place-items-center text-[#2b1a10] shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45"
      >
        <ArrowRight size={20} strokeWidth={1.8} className="mr-0.5" />
      </button>

      <main className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center px-5 pb-24 pt-20">
        <div className="relative mb-7 flex h-[min(58vw,280px)] w-[min(58vw,280px)] max-w-[280px] items-center justify-center">
          {isDownloading && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 z-0 rounded-full border-[3px] border-[#b88a4f]/15 border-t-[#b88a4f] border-r-[#deab65]/80"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.15, repeat: Infinity, ease: "linear" }}
            />
          )}

          {isDownloading && (
            <svg
              className="pointer-events-none absolute -inset-1 z-0 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)] -rotate-90 overflow-visible"
              viewBox="0 0 280 280"
              aria-hidden="true"
            >
              <circle cx="140" cy="140" r="136" fill="none" stroke="rgba(184,138,79,0.12)" strokeWidth="4" />
              <circle
                cx="140"
                cy="140"
                r="136"
                fill="none"
                stroke="#b88a4f"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="854.51"
                strokeDashoffset={854.51 - (854.51 * progress) / 100}
                className="transition-[stroke-dashoffset] duration-300 ease-out"
                style={{ filter: "drop-shadow(0 2px 6px rgba(184,138,79,0.3))" }}
              />
            </svg>
          )}

          <img
            src={publicAssetUrl("images/quran-circle.png")}
            alt="القرآن الكريم"
            className="relative z-10 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain drop-shadow-[0_12px_28px_rgba(43,26,16,0.15)]"
            loading="eager"
            decoding="async"
          />
        </div>

        <section className="flex w-full max-w-[360px] flex-col items-center text-center">
          <h2 className="font-display text-[22px] font-black leading-tight text-[#2b1a10] sm:text-[26px]">
            تنزيل المصحف والتفسير
          </h2>

          <div className="mt-3 flex min-h-[72px] w-full flex-col items-center justify-start">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stageText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className={`max-w-[320px] text-[14px] leading-7 ${isError ? "text-[#8f4d3d]" : "text-[#7f6a55]"}`}
              >
                {stageText}
              </motion.p>
            </AnimatePresence>
            {isDownloading && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1 tabular-nums text-[15px] font-bold text-[#b88a4f]"
                dir="ltr"
              >
                {progress}%
              </motion.span>
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
              className="flex h-12 w-full max-w-[320px] items-center justify-center gap-3 rounded-full bg-[#2b1a10] px-5 text-[14px] font-black text-[#f7f2ea] shadow-[0_14px_24px_-16px_rgba(43,26,16,0.85)] transition-[transform,background-color,box-shadow] duration-200 hover:bg-[#3a2417] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ece7de] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={18} strokeWidth={2} />
              <span>{isError ? "حاول مرة أخرى" : "تنزيل المصحف والتفسير"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
