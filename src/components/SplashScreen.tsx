import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import QcfVerse from "./QcfVerse";
import { APP_VERSES } from "@/constants/appVerses";
import { areFontsExtracted } from "@/hooks/useQcfFont";

interface SplashScreenProps {
  onComplete: () => void;
  canComplete: boolean;
}

const MIN_DISPLAY_MS = 1500;

export default function SplashScreen({ onComplete, canComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isVerseReady, setIsVerseReady] = useState(false);
  const [shouldTryQcf, setShouldTryQcf] = useState(false);
  const startedAtRef = useRef(typeof performance === "undefined" ? Date.now() : performance.now());
  const prefersReducedMotion = useReducedMotion();

  // قفل محاولة QCF: متحاولش تحمل QCF خالص لو الخطوط مش مستخرجة
  // على تنزيل أول مرة، الشاشة الترحيبية بتظهر قبل ما المستخدم يعمل تنزيل أصلاً
  useEffect(() => {
    let mounted = true;
    areFontsExtracted().then((extracted) => {
      if (mounted && extracted) setShouldTryQcf(true);
    });
    return () => { mounted = false; };
  }, []);

  // قلب الـ gating: الشاشة تختفي بعد max(MIN_DISPLAY_MS, app ready) بغض النظر عن الآية
  // لو الآية ظهرت قبلها — ممتاز. لو اتأخرت — الشاشة بتختفي عادي والآية بتكمل في الخلفية.
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

  const fadeDuration = prefersReducedMotion ? 0.01 : 0.4;
  const revealDuration = prefersReducedMotion ? 0.01 : 0.5;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full cursor-default select-none items-center justify-center overflow-hidden bg-[#ece7de] px-[clamp(20px,5vw,64px)] text-[#2b1a10]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: fadeDuration, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* خلفية AuroraBackground — استخدم نفس الهوية البصرية */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(120% 80% at 50% 0%, #fdfcfb 0%, #f7f2ea 54%, #ece7de 100%)",
              }}
            />
            <div
              className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(222,171,101,0.28), transparent 70%)" }}
            />
            <div
              className="absolute -bottom-40 -left-24 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(184,138,79,0.18), transparent 70%)" }}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80" />

          <motion.div
            className="relative z-10 flex w-full max-w-[430px] flex-col items-center"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: revealDuration, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex flex-col items-center text-center">
              <span className="text-[clamp(0.58rem,1.7vw,0.72rem)] font-medium tracking-[0.34em] text-[#7f6a55]/65">SAKINAH</span>

              {/* staged reveal للاسم بدل shimmer — clip-path inset */}
              <div className="mt-2 overflow-hidden">
                <motion.h1
                  className="font-display text-[clamp(2rem,8vw,3.1rem)] font-black leading-none tracking-tight text-[#2b1a10]"
                  initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  transition={{ duration: revealDuration, delay: prefersReducedMotion ? 0 : 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  سَكِينَة
                </motion.h1>
              </div>

              <motion.p
                className="mt-3 text-[clamp(0.74rem,2vw,0.9rem)] font-medium text-[#7f6a55]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: revealDuration, delay: prefersReducedMotion ? 0 : 0.2 }}
              >
                طمأنينة في كل يوم
              </motion.p>
            </header>

            <motion.div
              className="mt-[clamp(28px,6vh,52px)] flex items-center gap-2 text-[#b88a4f]/70"
              initial={{ opacity: 0, scaleX: 0.7 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: revealDuration, delay: prefersReducedMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            >
              <span className="h-px w-[clamp(42px,12vw,82px)] bg-gradient-to-l from-transparent to-[#b88a4f]/65" />
              <span className="h-1.5 w-1.5 rotate-45 border border-[#b88a4f]/70" />
              <span className="h-px w-[clamp(42px,12vw,82px)] bg-gradient-to-r from-transparent to-[#b88a4f]/65" />
            </motion.div>

            {/* بطاقة الآية — KFGQPC Naskh فوراً + crossfade لـ QCF */}
            <motion.section
              className="cut-crystal-satin relative mt-[clamp(20px,4vh,34px)] flex min-h-[clamp(220px,30vh,286px)] w-full flex-col items-center justify-center overflow-hidden rounded-[32px] px-[clamp(20px,6vw,42px)] py-[clamp(24px,5vh,38px)] text-center"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: revealDuration, delay: prefersReducedMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/95" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#f7f2ea]/45 to-transparent" />

              <div className="relative z-10 flex min-h-[clamp(126px,18vh,170px)] w-full items-center justify-center">
                {/* طبقة QcfVerse — تظهر فوق KFGQPC لما الخط يجهز (crossfade) — بس لو الخطوط مستخرجة */}
                {shouldTryQcf && (
                  <motion.div
                    className="absolute inset-x-0 flex flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isVerseReady ? 1 : 0 }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden={!isVerseReady}
                  >
                    <div
                      id="splash-verse-qcf"
                      className="max-w-[min(100%,38rem)] text-[clamp(1.08rem,3.7vw,2.08rem)] leading-[2.15] text-[#2b1a10]"
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

                {/* طبقة KFGQPC Naskh — تظهر فوراً من أول paint (نص ثابت مش qpcV2) */}
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
                        className="font-quran max-w-[min(100%,38rem)] text-[clamp(1.08rem,3.7vw,2.08rem)] leading-[2.15] text-[#2b1a10]"
                        style={{ direction: "rtl" }}
                      >
                        ﴿ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا ﴾
                      </div>
                      <span className="mt-4 rounded-full border border-[#2b1a10]/10 bg-[#f7f2ea]/75 px-3 py-1 text-[clamp(0.62rem,1.7vw,0.78rem)] font-bold text-[#7f6a55]">
                        {APP_VERSES.splash.source}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>

            {/* Hairline progress indicator — بدل النقاط الثلاثة */}
            <div className="mt-[clamp(18px,4vh,28px)] h-px w-[clamp(120px,30vw,200px)] overflow-hidden bg-[#b88a4f]/15">
              <motion.div
                className="h-full bg-[#b88a4f]/60"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: MIN_DISPLAY_MS / 1000, ease: "linear" }}
              />
            </div>

            <footer className="mt-[clamp(14px,3vh,22px)] flex items-center gap-3 text-[clamp(0.62rem,1.7vw,0.76rem)] font-medium text-[#7f6a55]/65">
              <span>القرآن</span>
              <span className="h-1 w-1 rounded-full bg-[#b88a4f]/55" />
              <span>الأذكار</span>
              <span className="h-1 w-1 rounded-full bg-[#b88a4f]/55" />
              <span>مواقيت الصلاة</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
