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
 * شاشة بداية "الهدوء" — تصميم بسيط جداً من الصفر.
 *
 * ثلاثة عناصر فقط: الاسم، الآية، وخلفية سادة.
 * لا أشكال، لا نجوم، لا مربعات، لا footer، لا شريط تقدم.
 * الانتقال تلقائي بعد 2 ثانية.
 */
export default function SplashScreen({ onComplete, canComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isVerseReady, setIsVerseReady] = useState(false);
  const [shouldTryQcf, setShouldTryQcf] = useState(false);
  const startedAtRef = useRef(typeof performance === "undefined" ? Date.now() : performance.now());
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    areFontsExtracted().then((extracted) => {
      if (mounted && extracted) setShouldTryQcf(true);
    });
    return () => { mounted = false; };
  }, []);

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

  const ease = [0.16, 1, 0.3, 1] as const;
  const fadeDur = prefersReducedMotion ? 0.01 : 0.6;

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
          <div className="flex flex-col items-center px-6">
            {/* الاسم فقط */}
            <motion.h1
              className="font-display text-[clamp(2.5rem,11vw,4rem)] font-black leading-none tracking-tight text-[#2b1a10] text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: fadeDur, ease }}
            >
              سَكِينَة
            </motion.h1>

            {/* الآية — بدون بطاقة، مباشرة على الخلفية */}
            <motion.div
              className="mt-8 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: fadeDur, delay: prefersReducedMotion ? 0 : 0.3, ease }}
            >
              {/* طبقة QCF — بس لو الخطوط مستخرجة */}
              {shouldTryQcf && (
                <motion.div
                  className="absolute flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isVerseReady ? 1 : 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease }}
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

              {/* طبقة KFGQPC Naskh — فورية */}
              <AnimatePresence initial={false}>
                {!isVerseReady && (
                  <motion.div
                    key="verse-naskh"
                    className="flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
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
