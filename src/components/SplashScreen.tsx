import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { APP_VERSES } from "@/constants/appVerses";
import { areFontsExtracted } from "@/hooks/useQcfFont";
import QcfVerse from "./QcfVerse";

interface SplashScreenProps {
  onComplete: () => void;
  canComplete: boolean;
}

const MIN_DISPLAY_MS = 2000;

/**
 * شاشة بداية "النور المتجلي" — تصميم جديد كلياً من الصفر.
 *
 * المفهوم: محاكاة فتح مصحف حقيقي — النور يتجلى من المنتصف،
 * النجمة الإسلامية الثمانية تُرسم تدريجياً، الاسم يتكشف،
 * والآية تظهر فوراً بخط ناسخ قرآني.
 *
 * الانتقال تلقائي بعد 2 ثانية — لا حاجة للضغط.
 */
export default function SplashScreen({ onComplete, canComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isVerseReady, setIsVerseReady] = useState(false);
  const [shouldTryQcf, setShouldTryQcf] = useState(false);
  const startedAtRef = useRef(typeof performance === "undefined" ? Date.now() : performance.now());
  const prefersReducedMotion = useReducedMotion();

  // قفل محاولة QCF: لا تحاول تحميل QCF إلا إذا كانت الخطوط مستخرجة
  useEffect(() => {
    let mounted = true;
    areFontsExtracted().then((extracted) => {
      if (mounted && extracted) setShouldTryQcf(true);
    });
    return () => { mounted = false; };
  }, []);

  // الانتقال التلقائي — الشاشة تختفي بعد max(2s, appReady) بغض النظر عن الآية
  const finishWhenStable = useCallback(() => {
    const now = typeof performance === "undefined" ? Date.now() : performance.now();
    const elapsed = now - startedAtRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const timer = window.setTimeout(() => setIsVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, []);

  const handleVerseReady = useCallback(() => setIsVerseReady(true), []);

  useEffect(() => {
    if (!canComplete) return;
    return finishWhenStable();
  }, [canComplete, finishWhenStable]);

  const d = prefersReducedMotion ? 0.01 : 0.8;
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full cursor-default select-none items-center justify-center overflow-hidden bg-[#ece7de]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease }}
        >
          {/* === الخلفية: تدرج كريمي عميق + هالة ذهبية مركزية === */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 100% 80% at 50% 50%, #fdfcfb 0%, #f7f2ea 40%, #ece7de 75%, #e7dfd3 100%)",
            }}
          />
          {/* هالة ذهبية pulsing في المنتصف */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[60px]"
            style={{
              background: "radial-gradient(circle, rgba(222,171,101,0.18), transparent 70%)",
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.7, 0.5], scale: [0.8, 1.1, 1] }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 3, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
          />
          {/* طبقة grain خفيفة جداً */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />

          {/* === المحتوى المركزي === */}
          <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center px-[clamp(20px,5vw,48px)]">
            {/* === النجمة الإسلامية الثمانية (SVG path animation) === */}
            <motion.div
              className="relative mb-[clamp(20px,4vh,32px)] flex items-center justify-center"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: d, ease }}
            >
              <svg
                width="clamp(72px,18vw,96px)"
                height="clamp(72px,18vw,96px)"
                viewBox="0 0 100 100"
                fill="none"
                aria-hidden="true"
              >
                {/* النجمة الثمانية الخارجية — path animation */}
                <motion.path
                  d="M50 8 L61 28 L83 22 L77 44 L97 55 L77 66 L83 88 L61 82 L50 100 L39 82 L17 88 L23 66 L3 55 L23 44 L17 22 L39 28 Z"
                  stroke="#b88a4f"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  fill="rgba(222,171,101,0.04)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.7 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 1.5, ease, delay: 0.1 }}
                />
                {/* دائرة داخلية */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="20"
                  stroke="#deab65"
                  strokeWidth="0.8"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 1, ease, delay: 0.6 }}
                />
                {/* نقطة مركزية */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="2.5"
                  fill="#b88a4f"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.4, ease, delay: 1.2 }}
                />
              </svg>
            </motion.div>

            {/* === الاسم: "سَكِينَة" — mask reveal من فوق لتحت === */}
            <div className="overflow-hidden">
              <motion.h1
                className="font-display text-[clamp(2.2rem,9vw,3.4rem)] font-black leading-none tracking-tight text-[#2b1a10] text-center"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: d, ease, delay: prefersReducedMotion ? 0 : 0.3 }}
              >
                سَكِينَة
              </motion.h1>
            </div>

            {/* === التوقيع === */}
            <motion.p
              className="mt-2 text-[clamp(0.72rem,2vw,0.86rem)] font-medium tracking-wide text-[#7f6a55]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.6, delay: prefersReducedMotion ? 0 : 0.6 }}
            >
              طمأنينة في كل يوم
            </motion.p>

            {/* === فاصل زخرفي === */}
            <motion.div
              className="mt-[clamp(20px,4vh,32px)] flex items-center gap-2"
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: d, delay: prefersReducedMotion ? 0 : 0.7, ease }}
              aria-hidden="true"
            >
              <span className="h-px w-[clamp(32px,10vw,64px)] bg-gradient-to-l from-transparent to-[#b88a4f]/50" />
              <span className="h-1 w-1 rotate-45 bg-[#b88a4f]/60" />
              <span className="h-px w-[clamp(32px,10vw,64px)] bg-gradient-to-r from-transparent to-[#b88a4f]/50" />
            </motion.div>

            {/* === بطاقة الآية === */}
            <motion.div
              className="cut-crystal-satin relative mt-[clamp(20px,4vh,32px)] flex w-full flex-col items-center justify-center overflow-hidden rounded-[28px] px-[clamp(20px,5vw,36px)] py-[clamp(20px,4vh,30px)]"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: d, delay: prefersReducedMotion ? 0 : 0.8, ease }}
            >
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#f7f2ea]/40 to-transparent" />

              {/* حاوية ثابتة الارتفاع لمنع layout shift */}
              <div className="relative z-10 flex min-h-[clamp(100px,14vh,140px)] w-full items-center justify-center">
                {/* طبقة QCF — بس لو الخطوط مستخرجة */}
                {shouldTryQcf && (
                  <motion.div
                    className="absolute inset-x-0 flex flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isVerseReady ? 1 : 0 }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease }}
                    aria-hidden={!isVerseReady}
                  >
                    <div
                      className="max-w-[min(100%,36rem)] text-[clamp(1rem,3.5vw,1.8rem)] leading-[2.1] text-[#2b1a10] text-center"
                      style={{ direction: "rtl", fontFamily: "QCF_P095, 'KFGQPC Uthman Taha Naskh', serif" }}
                    >
                      <QcfVerse
                        verseKey={APP_VERSES.splash.verseKey}
                        pageNumber={APP_VERSES.splash.pageNumber}
                        wordStart={APP_VERSES.splash.wordStart}
                        wordEnd={APP_VERSES.splash.wordEnd}
                        hideFallback
                        onReady={handleVerseReady}
                      />
                    </div>
                  </motion.div>
                )}

                {/* طبقة KFGQPC Naskh — فورية دائماً */}
                <AnimatePresence initial={false}>
                  {!isVerseReady && (
                    <motion.div
                      key="verse-naskh"
                      className="absolute inset-x-0 flex flex-col items-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div
                        className="font-quran max-w-[min(100%,36rem)] text-[clamp(1rem,3.5vw,1.8rem)] leading-[2.1] text-[#2b1a10] text-center"
                        style={{ direction: "rtl" }}
                      >
                        ﴿ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا ﴾
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* مصدر الآية */}
              <motion.span
                className="relative z-10 mt-3 rounded-full border border-[#2b1a10]/8 bg-[#f7f2ea]/60 px-3 py-1 text-[clamp(0.6rem,1.6vw,0.74rem)] font-bold text-[#7f6a55]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 1 }}
              >
                {APP_VERSES.splash.source}
              </motion.span>
            </motion.div>

            {/* === شريط تقدم رقيق === */}
            <div className="mt-[clamp(18px,3vh,26px)] h-px w-[clamp(100px,25vw,160px)] overflow-hidden bg-[#b88a4f]/12">
              <motion.div
                className="h-full bg-[#b88a4f]/50"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: MIN_DISPLAY_MS / 1000, ease: "linear" }}
              />
            </div>

            {/* === Footer === */}
            <motion.footer
              className="mt-[clamp(14px,2.5vh,20px)] flex items-center gap-2.5 text-[clamp(0.6rem,1.6vw,0.72rem)] font-medium text-[#7f6a55]/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 1.2 }}
            >
              <span>القرآن</span>
              <span className="h-0.5 w-0.5 rounded-full bg-[#b88a4f]/40" />
              <span>الأذكار</span>
              <span className="h-0.5 w-0.5 rounded-full bg-[#b88a4f]/40" />
              <span>مواقيت الصلاة</span>
            </motion.footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
