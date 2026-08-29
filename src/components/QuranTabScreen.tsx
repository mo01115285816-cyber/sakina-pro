import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, X } from "lucide-react";
import type { Reciter, Moshaf } from "@/types/quran";
import { surahNames } from "@/data/surahNames";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { RadioStation } from "@/types/radio";

// Import our new independent screens
import QuranRecitersScreen from "./QuranRecitersScreen";
import QuranSurahsScreen from "./QuranSurahsScreen";
import QuranAudioPlayerScreen from "./QuranAudioPlayerScreen";
import QuranReaderScreen from "./QuranReaderScreen";
import QuranReadingGatewayScreen from "./QuranReadingGatewayScreen";
import QuranDownloadScreen from "./QuranDownloadScreen";
import QuranPureRecitationsScreen, {
  type PureAudioReciter,
  type PureAudioTrack,
} from "./QuranPureRecitationsScreen";
import { QuranOfflineService } from "@/services/QuranOfflineService";
import { RadioMediaService } from "@/services/RadioMediaService";
import { QuranMediaService } from "@/services/QuranMediaService";
import { prefetchAllQcfFonts, isFontsPrefetched } from "@/hooks/useQcfFont";
import { publicAssetUrl } from "@/utils/publicAssetUrl";
import { RadioCaptureService, type RadioCaptureState } from "@/services/radioCaptureService";

interface Props {
  onBack?: () => void;
  onHideNavChange?: (hide: boolean) => void;
  isActive?: boolean;
}

const QuranTabScreen = React.memo(function QuranTabScreen({ onBack, onHideNavChange, isActive = true }: Props) {
  // Master Mode: "listening" (audio, broadcast, reciters) or "reading" (gate layout)
  const [quranMode, setQuranMode] = useState<"listening" | "reading">("listening");

  // Navigation stack: regular reciters, pure recitations, or surahs
  const [currentScreen, setCurrentScreen] = useState<"reciters" | "pureRecitations" | "surahs">("reciters");
  
  // Selection states
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [selectedMoshaf, setSelectedMoshaf] = useState<Moshaf | null>(null);

  // Radio states
  const [currentPlayingRadio, setCurrentPlayingRadio] = useState<RadioStation | null>(null);
  const [radioCaptureState, setRadioCaptureState] = useState<RadioCaptureState>(() => RadioCaptureService.getState());
  const [radioCaptureNotice, setRadioCaptureNotice] = useState<string | null>(null);
  
  // Audio Player Engine States
  const [playingSurahId, setPlayingSurahId] = useState<number | null>(null);
  const [playlist, setPlaylist] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("none");

  // Sleep Timer state
  const [timerMinutesRemaining, setTimerMinutesRemaining] = useState<number | null>(null);

  // Interactive Reading Screen State
  const [readingSurahId, setReadingSurahId] = useState<number | null>(null);
  const [readingInitialPage, setReadingInitialPage] = useState<number | undefined>(undefined);
  
  const [isQuranDownloaded, setIsQuranDownloaded] = useState<boolean | null>(null);

  useEffect(() => {
    QuranOfflineService.isDownloaded().then(downloaded => {
      setIsQuranDownloaded(downloaded);
      // للمستخدمين العائدين: prefetch الخطوط في الذاكرة تلقائياً عند فتح تبويب القرآن
      // إذا كانت الخطوط مستخرجة على القرص لكن لم تُحمَّل في الذاكرة بعد
      if (downloaded && !isFontsPrefetched()) {
        prefetchAllQcfFonts().catch((err) => {
          console.warn('Background font prefetch failed:', err);
        });
      }
    });
  }, []);

  const handleReadSurah = useCallback((surahId: number, page?: number) => {
    setReadingSurahId(surahId);
    setReadingInitialPage(page);
  }, []);

  // Keep the app navigation hidden inside focused Quran subpages and the player.
  useEffect(() => {
    onHideNavChange?.(
      isPlayerOpen ||
        readingSurahId !== null ||
        currentScreen === "surahs" ||
        currentScreen === "pureRecitations",
    );
  }, [currentScreen, isPlayerOpen, readingSurahId, onHideNavChange]);

  // Audio HTML Element Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep refs to avoid stale closures in event listeners and Media Session handlers
  const handleAudioEndedRef = useRef<() => void>(() => {});
  const radioCaptureStateRef = useRef<RadioCaptureState>(RadioCaptureService.getState());
  const stateRef = useRef({
    playlist,
    playingSurahId,
    currentPlayingRadio,
    isPlaying,
    repeatMode,
    selectedReciter,
    selectedMoshaf,
    playbackRate,
  });

  useEffect(() => {
    const unsubscribe = RadioCaptureService.subscribe((nextState) => {
      radioCaptureStateRef.current = nextState;
      setRadioCaptureState(nextState);
    });
    return () => {
      unsubscribe();
      void RadioCaptureService.stop("screen-closed");
    };
  }, []);

  useEffect(() => {
    handleAudioEndedRef.current = handleAudioEnded;
    stateRef.current = {
      playlist,
      playingSurahId,
      currentPlayingRadio,
      isPlaying,
      repeatMode,
      selectedReciter,
      selectedMoshaf,
      playbackRate,
    };
  });

  // Prevent background scrolling when audio player is open
  useEffect(() => {
    if (isPlayerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPlayerOpen]);

  // Keep track of any blob URL to revoke later
  const currentBlobUrl = useRef<string | null>(null);
  const pureTrackUrlsRef = useRef<Record<number, string>>({});
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const safePlay = useCallback(() => {
    if (!audioRef.current) return;
    const promise = audioRef.current.play();
    playPromiseRef.current = promise;
    promise.then(() => {
      if (playPromiseRef.current === promise) {
        playPromiseRef.current = null;
      }
    }).catch((err) => {
      if (playPromiseRef.current === promise) {
        playPromiseRef.current = null;
      }
      if (err.name !== "AbortError") {
        console.error("Audio playback failed:", err);
      }
    });
  }, []);

  const safePause = useCallback(() => {
    setIsPlaying(false);
    if (!audioRef.current) return;
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }
    if (playPromiseRef.current) {
      const currentPromise = playPromiseRef.current;
      currentPromise.then(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }).catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, []);

  const stopRadioCapture = useCallback(async (reason: string) => {
    if (radioCaptureStateRef.current === "idle") return null;
    try {
      const result = await RadioCaptureService.stop(reason);
      if (result) {
        setRadioCaptureNotice(`تم حفظ ${result.fileName}`);
        window.setTimeout(() => setRadioCaptureNotice(null), 4500);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر حفظ تسجيل البث.";
      setRadioCaptureNotice(message);
      window.setTimeout(() => setRadioCaptureNotice(null), 5000);
      return null;
    }
  }, []);

  const toggleRadioCapture = useCallback(async () => {
    const station = stateRef.current.currentPlayingRadio;
    if (!station || !stateRef.current.isPlaying) return;

    if (radioCaptureStateRef.current === "recording") {
      await stopRadioCapture("manual");
      return;
    }

    if (radioCaptureStateRef.current !== "idle") return;

    try {
      await RadioCaptureService.start(station, audioRef.current);
      setRadioCaptureNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر بدء تسجيل البث.";
      setRadioCaptureNotice(message);
      window.setTimeout(() => setRadioCaptureNotice(null), 5000);
    }
  }, [stopRadioCapture]);

  // Play a specific surah, optionally using a newly selected pure-recitation source.
  const playSurah = useCallback(
    (
      surahId: number,
      allSurahs: number[],
      sourceOverride?: { reciter: Reciter; moshaf: Moshaf },
    ) => {
      const {
        selectedReciter: activeReciter,
        selectedMoshaf: activeMoshaf,
        playbackRate: currentRate,
      } = stateRef.current;
      const reciter = sourceOverride?.reciter ?? activeReciter;
      const moshaf = sourceOverride?.moshaf ?? activeMoshaf;
      if (!reciter || !moshaf) return;

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }

    // Stop any active radio and finalize any active radio capture before Quran playback.
    void stopRadioCapture("switch-to-quran");
    setCurrentPlayingRadio(null);

    // IMMEDIATE STATE UPDATE FOR FAST TRANSITION
    setPlayingSurahId(surahId);
    setPlaylist(allSurahs);
    setIsPlayerOpen(true);
    setIsPlaying(true);

    const audioUrl =
      pureTrackUrlsRef.current[surahId] ??
      `${moshaf.server}${surahId.toString().padStart(3, "0")}.mp3`;

    // Defer audio loading slightly to guarantee a 60fps immediate screen transition
    playTimeoutRef.current = setTimeout(async () => {
      if (audioRef.current) {
        try {
          const { getAudioUrl } = await import('@/utils/audioCache');
          const finalUrl = await getAudioUrl(audioUrl);
          
          if (currentBlobUrl.current && currentBlobUrl.current.startsWith('blob:')) {
            URL.revokeObjectURL(currentBlobUrl.current);
          }
          currentBlobUrl.current = finalUrl;
          
          audioRef.current.src = finalUrl;
          audioRef.current.playbackRate = currentRate;
          safePlay();
        } catch (err) {
          console.error("Error loading audio URL:", err);
          audioRef.current.src = audioUrl; // Fallback
          audioRef.current.playbackRate = currentRate;
          safePlay();
        }
      }
    }, 10);
    },
    [safePlay, stopRadioCapture],
  );

  // Play/Pause Live Radio
  const playRadio = useCallback(async (radio: RadioStation) => {
    if (!audioRef.current) return;

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }

    // Stop any active surah. Switching stations finalizes the previous capture automatically.
    setPlayingSurahId(null);
    if (stateRef.current.currentPlayingRadio?.id !== radio.id) {
      await stopRadioCapture("station-switch");
    }

    setCurrentPlayingRadio(radio);
    setIsPlaying(true); // immediate feedback

    audioRef.current.src = radio.url;
    safePlay();
  }, [safePlay, stopRadioCapture]);

  const pauseRadio = useCallback(() => {
    void stopRadioCapture("playback-paused");
    safePause();
  }, [safePause, stopRadioCapture]);

  const handleTogglePlay = useCallback(() => {
    const { currentPlayingRadio, playingSurahId, isPlaying: currentIsPlaying } = stateRef.current;
    if (!audioRef.current) return;

    if (currentPlayingRadio !== null) {
      if (currentIsPlaying) {
        void stopRadioCapture("playback-paused");
        safePause();
      } else {
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
        }
        // Reload stream to avoid buffer/latency delay
        audioRef.current.src = currentPlayingRadio.url;
        setIsPlaying(true);
        safePlay();
      }
      return;
    }

    if (playingSurahId === null) return;

    if (currentIsPlaying) {
      safePause();
    } else {
      setIsPlaying(true);
      safePlay();
    }
  }, [safePlay, safePause, stopRadioCapture]);

  const handleNext = useCallback(() => {
    const { playlist: currentPlaylist, playingSurahId: currentPlayingId, repeatMode: currentRepeat } = stateRef.current;
    if (currentPlaylist.length === 0 || currentPlayingId === null) return;
    const currentIndex = currentPlaylist.indexOf(currentPlayingId);
    if (currentIndex === -1) return;

    if (currentIndex < currentPlaylist.length - 1) {
      playSurah(currentPlaylist[currentIndex + 1], currentPlaylist);
    } else if (currentRepeat === "all") {
      playSurah(currentPlaylist[0], currentPlaylist); // Loop back to start
    }
  }, [playSurah]);

  const handlePrev = useCallback(() => {
    const { playlist: currentPlaylist, playingSurahId: currentPlayingId } = stateRef.current;
    if (currentPlaylist.length === 0 || currentPlayingId === null) return;
    const currentIndex = currentPlaylist.indexOf(currentPlayingId);
    if (currentIndex === -1) return;

    if (currentIndex > 0) {
      playSurah(currentPlaylist[currentIndex - 1], currentPlaylist);
    }
  }, [playSurah]);

  const handleAudioEnded = () => {
    const { repeatMode: currentRepeat } = stateRef.current;
    if (currentRepeat === "one") {
      // Replay current surah
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        safePlay();
      }
    } else {
      handleNext();
    }
  };

  // Initialize audio object once on mount
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const handleEnded = () => {
      handleAudioEndedRef.current();
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current);
      }
    };
  }, []);

  // Sync Volume & Playback Rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Listen for App/Tab becoming active (e.g., clicking on the lockscreen notification to focus the app)
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        if (playingSurahId !== null) {
          setIsPlayerOpen(true);
        } else if (currentPlayingRadio !== null) {
          setCurrentScreen("reciters");
          setTimeout(() => {
            const element = document.getElementById("live-broadcast-section");
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 150);
        }
      }
    };

    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [playingSurahId, currentPlayingRadio]);

  // Synchronize playback with native Media Session services (Android / Lock Screen)
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const syncMediaSession = async () => {
      if (currentPlayingRadio !== null) {
        // Radio is playing
        const logoUrl = currentPlayingRadio.logoType === "sba" 
          ? publicAssetUrl("images/sba_radio_artwork.jpg")
          : publicAssetUrl("images/cairo_radio_artwork.jpg");

        await RadioMediaService.init(
          audio,
          currentPlayingRadio.name,
          currentPlayingRadio.subtitle || "البث المباشر",
          logoUrl,
          handleTogglePlay,
          handleTogglePlay
        );
        await RadioMediaService.updatePlaybackState(isPlaying ? "playing" : "paused");
      } else if (playingSurahId !== null && selectedReciter !== null) {
        // Surah is playing
        const surahName = surahNames[playingSurahId] || `سورة ${playingSurahId}`;
        await QuranMediaService.init(
          audio,
          selectedReciter.name,
          surahName,
          handleTogglePlay,
          handleTogglePlay,
          handleNext,
          handlePrev
        );
        await QuranMediaService.updatePlaybackState(isPlaying ? "playing" : "paused");
      } else {
        // Nothing is playing, update states
        await RadioMediaService.updatePlaybackState("none");
        await QuranMediaService.updatePlaybackState("none");
      }
    };

    syncMediaSession().catch((err) => {
      console.warn("Failed to sync media session services:", err);
    });
  }, [playingSurahId, selectedReciter, currentPlayingRadio, isPlaying, handleTogglePlay, handleNext, handlePrev]);

  // Handle sleep timer countdown
  useEffect(() => {
    if (timerMinutesRemaining === null || !isPlaying) return;

    const timer = setInterval(() => {
      setTimerMinutesRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1 / 60) {
          // Timer reached 0, pause playback
          if (audioRef.current) {
            audioRef.current.pause();
          }
          void stopRadioCapture("sleep-timer");
          setIsPlaying(false);
          return null;
        }
        return prev - 1 / 60; // Subtract 1 second
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerMinutesRemaining, isPlaying, stopRadioCapture]);


  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSelectReciter = (reciter: Reciter, moshaf: Moshaf) => {
    pureTrackUrlsRef.current = {};
    setSelectedReciter(reciter);
    setSelectedMoshaf(moshaf);
    setCurrentScreen("surahs");
  };

  const handleBackToReciters = () => {
    setCurrentScreen("reciters");
  };

  const handleOpenPureRecitations = () => {
    setCurrentScreen("pureRecitations");
  };

  const handlePlayPureTrack = useCallback(
    (reciter: PureAudioReciter, track: PureAudioTrack, playlistTracks: PureAudioTrack[]) => {
      pureTrackUrlsRef.current = Object.fromEntries(
        playlistTracks.map((playlistTrack) => [playlistTrack.surahId, playlistTrack.url]),
      );
      const playableIds = playlistTracks.map((playlistTrack) => playlistTrack.surahId);
      const pureReciter: Reciter = {
        id: Math.abs(Array.from(reciter.id).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)) || 1,
        name: reciter.name,
        letter: reciter.name.trim().charAt(0),
        photoUrl: reciter.photoUrl,
        moshaf: [],
      };
      const pureMoshaf: Moshaf = {
        id: pureReciter.id,
        name: "تلاوة نقية",
        server: "",
        surah_total: playableIds.length,
        surah_list: playableIds.join(","),
      };
      setSelectedReciter(pureReciter);
      setSelectedMoshaf(pureMoshaf);
      playSurah(track.surahId, playableIds, {
        reciter: pureReciter,
        moshaf: pureMoshaf,
      });
    },
    [playSurah],
  );

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
  };

  const handleOpenTimerSheet = () => {
    setIsPlayerOpen(true);
    // Timer bottom sheet can be triggered on player
  };

  return (
    <div className="w-full min-h-screen relative flex flex-col" dir="rtl">
      {/* Normal Tab Screens navigation: Reciters, Surah list, or Reading Gateway (Always optimized to guarantee INSTANT performance) */}
      <div className="w-full flex-1 flex flex-col">
        {quranMode === "listening" ? (
          <>
            <div className={currentScreen === "reciters" ? "block w-full" : "hidden"}>
              <QuranRecitersScreen
                isActive={isActive && currentScreen === "reciters"}
                onSelectReciter={handleSelectReciter}
                playingSurahId={playingSurahId}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                onOpenPlayer={() => setIsPlayerOpen(true)}
                onClosePlayer={() => setPlayingSurahId(null)}
                selectedReciter={selectedReciter}
                selectedMoshaf={selectedMoshaf}
                audioRef={audioRef}
                currentPlayingRadio={currentPlayingRadio}
                radioCaptureState={radioCaptureState}
                onToggleRadioCapture={toggleRadioCapture}
                radioCaptureNotice={radioCaptureNotice}
                onPlayRadio={playRadio}
                onPauseRadio={pauseRadio}
                onModeChange={setQuranMode}
                onOpenPureRecitations={handleOpenPureRecitations}
              />
            </div>

            <div className={currentScreen === "pureRecitations" ? "block w-full" : "hidden"}>
              <QuranPureRecitationsScreen
                isActive={isActive && currentScreen === "pureRecitations"}
                onBack={handleBackToReciters}
                onPlayTrack={handlePlayPureTrack}
                currentlyPlayingId={playingSurahId || undefined}
                isPlaying={isPlaying}
                onTriggerTimer={handleOpenTimerSheet}
                onReadSurah={handleReadSurah}
              />
            </div>

            <div className={currentScreen === "surahs" ? "block w-full" : "hidden"}>
              {selectedReciter && selectedMoshaf && (
                <QuranSurahsScreen
                  reciter={selectedReciter}
                  moshaf={selectedMoshaf}
                  onBack={handleBackToReciters}
                  onPlaySurah={playSurah}
                  currentlyPlayingId={playingSurahId || undefined}
                  isPlaying={isPlaying}
                  onTriggerTimer={handleOpenTimerSheet}
                  onReadSurah={handleReadSurah}
                />
              )}
            </div>
          </>
        ) : isQuranDownloaded === null ? (
          <div className="w-full h-[80vh] flex items-center justify-center">
             <SakeenahLineSpinner size={32} color="#b88a4f" label="جارٍ فحص حالة المصحف" />
          </div>
        ) : isQuranDownloaded === false ? (
          <QuranDownloadScreen
            onClose={() => setQuranMode("listening")}
            onDownloaded={() => setIsQuranDownloaded(true)}
          />
        ) : (
          <QuranReadingGatewayScreen
            onReadSurah={handleReadSurah}
            onModeChange={setQuranMode}
          />
        )}
      </div>

      {/* Full screen audio player overlay (slides up immediately on top) */}
      <AnimatePresence>
        {isPlayerOpen && playingSurahId !== null && selectedReciter && selectedMoshaf && (
          <motion.div
            key="player-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50 overflow-hidden shadow-2xl"
          >
            <QuranAudioPlayerScreen
              audioRef={audioRef}
              reciter={selectedReciter}
              moshaf={selectedMoshaf}
              surahId={playingSurahId}
              onClose={handleClosePlayer}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onPrev={handlePrev}
              onNext={handleNext}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              volume={volume}
              onVolumeChange={setVolume}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              timerMinutesRemaining={timerMinutesRemaining}
              onSetTimer={setTimerMinutesRemaining}
              repeatMode={repeatMode}
              onSetRepeatMode={setRepeatMode}
              playlist={playlist}
              onPlaySurah={playSurah}
              onOpenReader={() => {
                setReadingSurahId(playingSurahId);
                setIsPlayerOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent floating Mini Player above bottom bar */}
      <AnimatePresence>
        {((playingSurahId !== null && !isPlayerOpen && selectedReciter && selectedMoshaf) || 
          (currentPlayingRadio !== null && !isPlayerOpen)) && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed bottom-[94px] inset-x-6 z-40 flex items-center justify-center pointer-events-none"
            dir="rtl"
          >
            <div 
              onClick={() => {
                if (playingSurahId !== null) {
                  setIsPlayerOpen(true);
                } else if (currentPlayingRadio !== null) {
                  setCurrentScreen("reciters");
                  setTimeout(() => {
                    const element = document.getElementById("live-broadcast-section");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }, 120);
                }
              }}
              className="w-full max-w-[380px] cut-crystal-capsule shadow-lg py-1.5 pr-1.5 pl-2.5 flex items-center justify-between pointer-events-auto cursor-pointer active:scale-[0.98] transition-all"
            >
              {/* Right Side: Circular Avatar Artwork & Audio texts */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {currentPlayingRadio !== null ? (
                  <div className={`relative w-[42px] h-[42px] rounded-full text-white flex items-center justify-center text-[12.5px] font-black shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.12)] ring-2 ring-[#fdfcfb] overflow-hidden ${
                    currentPlayingRadio.logoType === "sba"
                      ? "bg-gradient-to-br from-[#e0b06b] via-[#c49a62] to-[#a37c48]"
                      : "bg-gradient-to-br from-[#136a64] via-[#0f5752] to-[#0a3b38]"
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent opacity-60 rounded-full"></div>
                    <span className="relative z-10 drop-shadow-sm">{currentPlayingRadio.logoType === "sba" ? "بث" : "مباشر"}</span>
                  </div>
                ) : (
                  /* Circular Artwork thumbnail */
                  <div className="relative w-[42px] h-[42px] rounded-full text-white flex items-center justify-center text-[16px] font-bold shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.12)] ring-2 ring-[#fdfcfb] overflow-hidden bg-gradient-to-br from-[#e0b06b] via-[#c49a62] to-[#a37c48]">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent opacity-60 rounded-full"></div>
                    <span className="relative z-10 drop-shadow-sm">{selectedReciter.name.trim().charAt(0)}</span>
                  </div>
                )}

                {/* Surah Name & Reciter Subtitle */}
                <div className="text-right flex flex-col justify-center pb-[1px] overflow-hidden flex-1 max-w-[200px] xs:max-w-[220px] sm:max-w-[250px]">
                  <h4 className="text-[14px] font-black text-[#2b1a10] leading-tight font-sans mb-[1px] truncate w-full">
                    {currentPlayingRadio !== null 
                      ? currentPlayingRadio.name 
                      : (surahNames[playingSurahId!] || `سورة ${playingSurahId}`)}
                  </h4>
                  <p className="text-[11.5px] text-[#8c7a65] font-bold leading-none font-sans truncate w-full">
                    {currentPlayingRadio !== null ? "بث مباشر" : selectedReciter.name}
                  </p>
                </div>
              </div>

              {/* Left Side: Playback Control & Close Button */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* Micro play pause */}
                <button
                  onClick={handleTogglePlay}
                  className="w-[38px] h-[38px] flex items-center justify-center bg-[#b88a4f]/15 hover:bg-[#b88a4f]/25 active:scale-95 transition-all rounded-full text-[#b88a4f]"
                >
                  {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} className="translate-x-[1px]" fill="currentColor" />}
                </button>

                {/* Close player completely */}
                <button
                  onClick={() => {
                    void stopRadioCapture("player-closed");
                    safePause();
                    setPlayingSurahId(null);
                    setCurrentPlayingRadio(null);
                  }}
                  className="w-[38px] h-[38px] flex items-center justify-center bg-white/25 hover:bg-white/40 active:scale-95 transition-all rounded-full text-[#8c7a65]"
                >
                  <X size={17} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full screen Quran Reader overlay (slides up immediately on top) */}
      <AnimatePresence>
        {readingSurahId !== null && (
          <motion.div
            key="reader-screen"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-0 z-50 bg-[#f7f2ea] overflow-hidden"
          >
            <QuranReaderScreen
              surahId={readingSurahId}
              initialPage={readingInitialPage}
              onClose={() => {
                setReadingSurahId(null);
                setReadingInitialPage(undefined);
              }}
              onPlayAudio={(id) => {
                // If it's already the active playing surah, toggle play, otherwise start playing it!
                if (playingSurahId === id) {
                  handleTogglePlay();
                } else {
                  // Generate Surah list for playing
                  const { selectedMoshaf: moshaf } = stateRef.current;
                  if (moshaf) {
                    const surahList = moshaf.surah_list.split(",").map(Number).filter((id) => !isNaN(id) && id > 0);
                    playSurah(id, surahList);
                  }
                }
              }}
              isPlaying={isPlaying && playingSurahId === readingSurahId}
              onTogglePlay={handleTogglePlay}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default QuranTabScreen;
