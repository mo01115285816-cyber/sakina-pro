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
 * شاشة بداية بسيطة جداً — اسم + آية فقط.
 * لا أشكال، لا نجوم، لا مربعات، لا footer، لا شريط تقدم.
 * خلفية سادة كريمي. انتقال تلقائي بعد 2 ثانية.
 *
 * الأنيميشن سلس وسريع: fade in بسيط بدون أي حركة عمودية (y).
 * الاسم ثابت في مكانه — ما يتحركش.
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

  // الانتقال التلقائي — الشاشة تختفي بعد max(2s, appReady)
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

  // أنيميشن سريع وسلس: 0.35s — مش بطيء، مش مقفول
  const fadeDur = prefersReducedMotion ? 0.01 : 0.35;
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex min-h-[100dvh] w-full cursor-default select-none items-center justify-center overflow-hidden bg-[#ece7de]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeDur, ease }}
        >
          {/* 
            حاوية واحدة ثابتة — الاسم والآية جواها.
            مفيش y animation خالص عشان الاسم ما يتحركش.
            كل اللي بيتحرك هو opacity (fade) — سلس وسريع.
          */}
          <div className="flex flex-col items-center px-6">
            {/* الاسم — fade in فقط، صفر حركة عمودية */}
            <motion.h1
              className="font-display text-[clamp(2.5rem,11vw,4rem)] font-black leading-none tracking-tight text-[#2b1a10] text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: fadeDur, ease }}
            >
              سَكِينَة
            </motion.h1>

            {/* الآية — fade in بعد 0.15s، صفر حركة عمودية */}
            <motion.div
              className="mt-8 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: fadeDur, delay: prefersReducedMotion ? 0 : 0.15, ease }}
            >
              {/* طبقة QCF — بس لو الخطوط مستخرجة */}
              {shouldTryQcf && (
                <motion.div
                  className="absolute flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isVerseReady ? 1 : 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.3, ease }}
                  aria-hidden={!isVerseReady}
                >
                  <div
                    className="text-[clamp(1rem,4vw,1.6rem)] leading-[2.2] text-[#2b1a10] text-center"
                    style={{ direction: "rtl" }}
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
                    className="flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div
                      className="font-quran text-[clamp(1rem,4vw,1.6rem)] leading-[2.2] text-[#2b1a10] text-center"
                      style={{ direction: "rtl" }}
                    >
                      ﴿ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا ﴾
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
