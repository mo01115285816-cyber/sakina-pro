import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radio,
  Pause,
  ChevronLeft,
  ChevronRight,
  Circle,
  Square,
} from "lucide-react";
import { RadioStation } from "@/types/radio";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { radioStations } from "@/data/radioStations";
import type { RadioCaptureState } from "@/services/radioCaptureService";

interface Props {
  // Global Audio Ref & state controls provided by parent (QuranTabScreen)
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  currentPlayingRadio: RadioStation | null;
  isPlayingRadio: boolean;
  onPlayRadio: (radio: RadioStation) => void;
  onPauseRadio: () => void;
  radioCaptureState: RadioCaptureState;
  onToggleRadioCapture: () => void;
  radioCaptureNotice: string | null;
}

export default function QuranLiveBroadcast({
  audioRef,
  currentPlayingRadio,
  isPlayingRadio,
  onPlayRadio,
  onPauseRadio,
  radioCaptureState,
  onToggleRadioCapture,
  radioCaptureNotice,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const activeStation = radioStations[currentIndex];
  const scrimProfile =
    activeStation.logoType === "cairo"
      ? {
          primary:
            "linear-gradient(90deg, rgba(0,0,0,0) 18%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.64) 100%)",
          bottom:
            "linear-gradient(0deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 58%)",
        }
      : {
          primary:
            "linear-gradient(90deg, rgba(0,0,0,0) 18%, rgba(0,0,0,0.10) 48%, rgba(0,0,0,0.58) 100%)",
          bottom:
            "linear-gradient(0deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 58%)",
        };

  // Handle stream loading states
  useEffect(() => {
    if (!audioRef.current) return;

    const handleWaiting = () => {
      if (currentPlayingRadio?.id === activeStation.id) {
        setIsLoading(true);
      }
    };
    const handlePlaying = () => {
      if (currentPlayingRadio?.id === activeStation.id) {
        setIsLoading(false);
      }
    };
    const handleCanPlay = () => {
      if (currentPlayingRadio?.id === activeStation.id) {
        setIsLoading(false);
      }
    };
    const handleLoadedData = () => {
      if (currentPlayingRadio?.id === activeStation.id) {
        setIsLoading(false);
      }
    };

    const audio = audioRef.current;
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadeddata", handleLoadedData);

    return () => {
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [currentPlayingRadio, activeStation, audioRef]);

  // Update loading state when stream play/pause changes
  useEffect(() => {
    if (currentPlayingRadio?.id === activeStation.id && isPlayingRadio) {
      const audio = audioRef.current;
      if (audio && !audio.paused && audio.readyState >= 3) {
        setIsLoading(false);
      } else {
        setIsLoading(true); // set loading until buffer is ready
      }
    } else {
      setIsLoading(false);
    }
  }, [currentPlayingRadio, activeStation, isPlayingRadio, audioRef]);

  const handleNextStation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % radioStations.length);
  };

  const handlePrevStation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(
      (prev) => (prev - 1 + radioStations.length) % radioStations.length,
    );
  };

  const togglePlayback = () => {
    const isActive = currentPlayingRadio?.id === activeStation.id;
    if (isActive && isPlayingRadio) {
      onPauseRadio();
    } else {
      onPlayRadio(activeStation);
    }
  };

  const isActiveAndPlaying =
    currentPlayingRadio?.id === activeStation.id && isPlayingRadio;
  const isLiveReady = isActiveAndPlaying && !isLoading;
  const showCaptureControl = isLiveReady || radioCaptureState === "recording" || radioCaptureState === "saving";

  return (
    <div id="live-broadcast-section" className="w-full mb-6 relative" dir="rtl">
      {/* Title + capture control: hidden until a station is actually playing. */}
      <div className="mb-3.5 flex min-h-8 items-center gap-2 px-1">
        <h2 className="flex items-center gap-2 text-[20px] font-bold text-[#2b1a10]">
          <span>البث الصوتي</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#80a390]"></span>
        </h2>
        <div className="mr-auto flex items-center gap-2">
          {showCaptureControl && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleRadioCapture();
              }}
              disabled={radioCaptureState === "saving"}
              aria-label={radioCaptureState === "recording" ? "إيقاف وحفظ تسجيل البث" : "تسجيل البث"}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black shadow-sm transition-[background-color,color,border-color,transform] duration-150 active:scale-95 disabled:cursor-wait disabled:opacity-70 ${
                radioCaptureState === "recording"
                  ? "border-[#8f3c35]/35 bg-[#8f3c35] text-white"
                  : radioCaptureState === "saving"
                    ? "border-[#b88a4f]/30 bg-[#f7f2ea] text-[#8f765d]"
                    : "border-[#b88a4f]/45 bg-[#b88a4f] text-white"
              }`}
            >
              {radioCaptureState === "saving" ? (
                <SakeenahLineSpinner size={14} color="currentColor" label="جارٍ حفظ التسجيل" />
              ) : radioCaptureState === "recording" ? (
                <Square size={9} fill="currentColor" />
              ) : (
                <Circle size={9} fill="currentColor" />
              )}
              <span>
                {radioCaptureState === "saving"
                  ? "جاري الحفظ"
                  : radioCaptureState === "recording"
                    ? "إيقاف وحفظ"
                    : "تسجيل البث"}
              </span>
            </button>
          )}
          {radioCaptureNotice && (
            <span role="status" className="hidden max-w-[150px] truncate text-[10px] font-bold text-[#7f6a55] sm:inline">
              {radioCaptureNotice}
            </span>
          )}
        </div>
      </div>

      {/* Main Beautiful Card */}
      <div className="relative z-20">
        <div
          className="w-full overflow-hidden rounded-[26px] relative transition-all duration-500 cut-crystal-panel !border-white/10 !shadow-[0_12px_32px_rgba(0,0,0,0.18)] group select-none"
        >
          {/* Panoramic 21:9 Artwork Background */}
          <img
            src={
              activeStation.logoType === "cairo"
                ? "/images/cairo_radio_artwork.jpg"
                : "/images/sba_radio_artwork.jpg"
            }
            alt={activeStation.name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center transform group-hover:scale-[1.02] transition-transform duration-700 ease-out z-0"
          />

          {/* Dynamic optical scrims keep the right-aligned station copy readable without hiding the artwork. */}
          <div
            className="absolute inset-0 z-1 pointer-events-none"
            style={{ background: scrimProfile.primary }}
          />
          <div
            className="absolute inset-0 z-1 pointer-events-none"
            style={{ background: scrimProfile.bottom }}
          />

          {/* Compact navigation chevrons for stations; the transparent hit area is larger than the visible icon. */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 z-30 w-10 h-10 flex items-center justify-center pointer-events-auto touch-manipulation">
            <button
              type="button"
              onClick={handlePrevStation}
              className="w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 active:scale-90 flex items-center justify-center transition-all text-white/90 border border-white/15 backdrop-blur-md cursor-pointer shadow-sm hover:border-[#deab65]/50"
              title="الإذاعة السابقة"
              aria-label="الإذاعة السابقة"
            >
              <ChevronRight size={13} className="translate-x-[0.5px]" />
            </button>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-0 z-30 w-10 h-10 flex items-center justify-center pointer-events-auto touch-manipulation">
            <button
              type="button"
              onClick={handleNextStation}
              className="w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 active:scale-90 flex items-center justify-center transition-all text-white/90 border border-white/15 backdrop-blur-md cursor-pointer shadow-sm hover:border-[#deab65]/50"
              title="الإذاعة التالية"
              aria-label="الإذاعة التالية"
            >
              <ChevronLeft size={13} className="translate-x-[-0.5px]" />
            </button>
          </div>

          {/* Content Container */}
          <div className="pr-10 pl-10 py-3.5 flex items-center justify-between gap-3 relative z-10">
            {/* Texts & Controls on the Right (RTL means first element is rendered on the right) */}
            <div className="flex-1 flex flex-col text-right justify-center min-w-0">
              {/* AnimatePresence for smooth text transitions on swap */}
              <div className="h-[44px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStation.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <h3 className="text-[15px] sm:text-[16px] font-black text-white leading-tight mb-1 font-display drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] truncate">
                      {activeStation.name}
                    </h3>
                    <p className="text-[11px] text-[#f4efe8]/95 font-bold leading-none font-sans drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] truncate">
                      {activeStation.subtitle}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Action buttons section */}
              <div className="mt-2 flex items-center gap-2">
                {/* Play/Pause compact pill button with a larger transparent touch target. */}
                <div className="relative -m-2 p-2 touch-manipulation">
                  <button
                  onClick={togglePlayback}
                  disabled={isActiveAndPlaying && isLoading}
                  className={`h-7 px-3 rounded-full flex items-center justify-center gap-1.5 text-[11px] whitespace-nowrap font-bold tracking-wide transition-all active:scale-[0.96] shadow-md border shrink-0 cursor-pointer backdrop-blur-md ${
                    isActiveAndPlaying
                      ? "bg-[#dc2626]/90 hover:bg-[#dc2626] text-white border-red-300/50 shadow-red-950/30"
                      : "bg-[#deab65] hover:bg-[#c4904a] text-[#2b1a10] border-white/50 shadow-[#deab65]/20"
                  }`}
                >
                  {isLoading && isActiveAndPlaying ? (
                    <>
                      <SakeenahLineSpinner size={14} color="#ffffff" label="جارٍ الاتصال بالبث" className="shrink-0" />
                      <span>جاري الاتصال...</span>
                    </>
                  ) : isActiveAndPlaying ? (
                    <>
                      <Pause
                        size={11}
                        fill="currentColor"
                        className="shrink-0"
                      />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Radio size={11} className="text-[#2b1a10] shrink-0" />
                      <span>استماع مباشر</span>
                    </>
                  )}

                  {/* Animated active beacon dot if playing */}
                  {isActiveAndPlaying && !isLoading && (
                    <span className="relative flex h-1.5 w-1.5 mr-0.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                  )}

                  {/* Fixed red live dot when inactive but standby */}
                  {!isActiveAndPlaying && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-0.5 shrink-0"></span>
                  )}
                  </button>
                </div>
              </div>
            </div>

                          {/* Micro Live Wavebars on the far left (only when playback is ready). */}
              <div className="shrink-0 flex items-center justify-center pl-1 min-w-[28px]">
                <AnimatePresence>
                  {isLiveReady && (

                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-end gap-0.5 px-2 py-1.5 rounded-full bg-black/35 backdrop-blur-md border border-white/20 shadow-sm"
                  >
                    <span className="w-0.5 h-3 bg-[#deab65] animate-[bounce_0.7s_infinite_100ms] rounded-full" />
                    <span className="w-0.5 h-4 bg-[#deab65] animate-[bounce_0.7s_infinite_300ms] rounded-full" />
                    <span className="w-0.5 h-2.5 bg-[#deab65] animate-[bounce_0.7s_infinite_150ms] rounded-full" />
                    <span className="w-0.5 h-3.5 bg-[#deab65] animate-[bounce_0.7s_infinite_250ms] rounded-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
