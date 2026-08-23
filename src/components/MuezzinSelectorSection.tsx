/**
 * MuezzinSelectorSection — Sakineh-2.0.0 visual design with a4b380c real data/cache/download logic.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Play,
  Pause,
  Download,
  Check,
  Trash2,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import type { MuezzinTrack } from "@/types/prayer-settings";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { MUEZZIN_LIST } from "@/types/prayer-settings";

interface MuezzinSelectorSectionProps {
  selectedMuezzinId?: string;
  onSelect: (muezzin: MuezzinTrack) => void;
}

async function isMuezzinCached(fileName: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.stat({ path: `muezzins/${fileName}`, directory: Directory.Data });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const cache = await caches.open("sakeenah-azan-cache-v1");
    const response = await cache.match(`muezzin://${fileName}`);
    return !!response;
  } catch {
    return false;
  }
}

async function getMuezzinPlaybackUrl(track: MuezzinTrack, isDownloaded: boolean): Promise<string> {
  if (!isDownloaded) return track.url;

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.getUri({
        path: `muezzins/${track.fileName}`,
        directory: Directory.Data,
      });
      return result.uri;
    } catch {
      return track.url;
    }
  }

  try {
    const cache = await caches.open("sakeenah-azan-cache-v1");
    const response = await cache.match(`muezzin://${track.fileName}`);
    if (!response) return track.url;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return track.url;
  }
}

async function downloadMuezzinAudio(track: MuezzinTrack): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.mkdir({ path: "muezzins", directory: Directory.Data, recursive: true });
    } catch {
      // Directory already exists.
    }

    const destination = await Filesystem.getUri({
      path: `muezzins/${track.fileName}`,
      directory: Directory.Data,
    });
    await FileTransfer.downloadFile({
      url: track.url,
      path: destination.uri,
    });
    return;
  }

  const cache = await caches.open("sakeenah-azan-cache-v1");
  const response = await fetch(track.url);
  await cache.put(`muezzin://${track.fileName}`, response);
}

async function deleteMuezzinAudio(track: MuezzinTrack): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({ path: `muezzins/${track.fileName}`, directory: Directory.Data });
    } catch {
      // File may already be absent.
    }
    return;
  }

  try {
    const cache = await caches.open("sakeenah-azan-cache-v1");
    await cache.delete(`muezzin://${track.fileName}`);
  } catch {
    // Cache may be unavailable.
  }
}

export const MuezzinSelectorSection = React.memo(function MuezzinSelectorSection({
  selectedMuezzinId,
  onSelect,
}: MuezzinSelectorSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadedIds, setDownloadedIds] = useState<Record<string, boolean>>({});
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkCache() {
      const next: Record<string, boolean> = {};
      for (const track of MUEZZIN_LIST) {
        next[track.id] = await isMuezzinCached(track.fileName);
      }
      if (!cancelled) setDownloadedIds(next);
    }
    checkCache();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = useCallback(
    async (track: MuezzinTrack) => {
      try {
        if (playingId === track.id) {
          audioRef.current?.pause();
          setPlayingId(null);
          return;
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        const audioUrl = await getMuezzinPlaybackUrl(track, !!downloadedIds[track.id]);
        if (audioUrl.startsWith("blob:")) objectUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => setPlayingId(null);

        await audio.play();
        setPlayingId(track.id);

        // Save the selection via PrayerAlarmService when playing
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
          const { PrayerAlarmService } = await import("@/services/PrayerAlarmService");
          await PrayerAlarmService.saveSelectedMuezzin(track.id, track.fileName);
        }
      } catch (err) {
        console.warn("Error in playing preview:", err);
        setPlayingId(null);
      }
    },
    [playingId, downloadedIds],
  );

  const handleDownload = useCallback(async (track: MuezzinTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloadingIds[track.id] || downloadedIds[track.id]) return;

    setDownloadingIds((prev) => ({ ...prev, [track.id]: true }));
    try {
      // Download the file using native Filesystem plugin
      await downloadMuezzinAudio(track);

      // Save the selection via PrayerAlarmService
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        const { PrayerAlarmService } = await import("@/services/PrayerAlarmService");
        await PrayerAlarmService.saveSelectedMuezzin(track.id, track.fileName);
      }

      setDownloadedIds((prev) => ({ ...prev, [track.id]: true }));
    } catch (err) {
      console.warn("Download failed:", err);
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [track.id]: false }));
    }
  }, [downloadedIds, downloadingIds]);

  const handleDelete = useCallback(async (track: MuezzinTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`هل تريد حذف ملف الأذان لـ ${track.name}؟`);
    if (!confirmed) return;

    try {
      // Delete using native method
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        const { PrayerAlarmService } = await import("@/services/PrayerAlarmService");
        await PrayerAlarmService.deleteMuezzin(track.fileName);
      } else {
        await deleteMuezzinAudio(track);
      }

      setDownloadedIds((prev) => ({ ...prev, [track.id]: false }));
    } catch (err) {
      console.warn("Delete failed:", err);
    }
  }, []);

  const filteredMuezzins = MUEZZIN_LIST.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4 transition-all duration-300 w-full pt-1">
      {/* Outer Section Title */}
      <div className="flex items-center justify-between px-2">
        <h4 className="text-[13px] font-bold text-[#7f6a55] tracking-wide">
          صوت المؤذن
        </h4>
        <span className="text-[10.5px] font-bold text-[#b88a4f] bg-[#b88a4f]/10 px-2.5 py-0.5 rounded-full">
          {MUEZZIN_LIST.length} مؤذن
        </span>
      </div>

      {/* Elegant Capsule Search Input matching Sakineh-2.0.0 */}
      <div className="relative flex items-center bg-[#fdfcfb]/95 backdrop-blur-xl border border-[#e6dccf]/70 rounded-[20px] h-12.5 shadow-[0_4px_20px_rgba(43,26,16,0.03)] px-3.5 w-full">
        <Search className="text-[#b88a4f] ml-2.5 shrink-0" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث عن مؤذن..."
          className="flex-1 h-full bg-transparent border-none outline-none text-[14px] font-sans font-bold text-[#2b1a10] placeholder:text-[#7f6a55]/65 pt-0.5 text-right"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-[#7f6a55]/60 hover:text-[#2b1a10] transition-colors p-1"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Muezzin List of Independent Capsule Cards */}
      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 pb-1 hide-scrollbar">
        {filteredMuezzins.length === 0 ? (
          <p className="text-center text-[12px] font-bold text-[#7f6a55]/60 py-4">
            لا يوجد نتائج تطابق بحثك
          </p>
        ) : (
          filteredMuezzins.map((track) => {
            const isSelected = selectedMuezzinId === track.id;
            const isDownloaded = !!downloadedIds[track.id];
            const isDownloading = !!downloadingIds[track.id];
            const isPlaying = playingId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => onSelect(track)}
                className={`w-full flex items-center justify-between p-4 rounded-[22px] border backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                  isSelected
                    ? "bg-[#b88a4f]/10 border-[#b88a4f] shadow-[0_4px_16px_rgba(184,138,79,0.08)]"
                    : "bg-white/70 hover:bg-white border-white hover:border-[#b88a4f]/30 shadow-[0_2px_12px_rgba(43,26,16,0.02)]"
                }`}
              >
                {/* Right: Muezzin Name & active golden radio checkmark */}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? "border-[#b88a4f] bg-[#b88a4f]"
                        : "border-[#e6dccf] bg-white"
                    }`}
                  >
                    {isSelected && (
                      <Check size={10} className="text-white stroke-[3px]" />
                    )}
                  </div>
                  <span
                    className={`text-[13.5px] font-bold text-right transition-colors ${
                      isSelected ? "text-[#b88a4f]" : "text-[#2b1a10]"
                    }`}
                  >
                    {track.name}
                  </span>
                </div>

                {/* Left: Actions (Preview & Download/Delete) */}
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handlePlayPreview(track)}
                    className={`w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all border ${
                      isPlaying
                        ? "bg-[#b88a4f] text-white border-[#b88a4f]"
                        : "bg-white text-[#2b1a10] border-[#e6dccf] hover:bg-[#f7f2ea]"
                    }`}
                    title={isPlaying ? "إيقاف الاستماع" : "استماع تجريبي"}
                  >
                    {isPlaying ? (
                      <Pause size={13} className="fill-current" />
                    ) : (
                      <Play size={13} className="fill-current mr-[-1px]" />
                    )}
                  </button>

                  {isDownloading ? (
                    <div className="w-8.5 h-8.5 rounded-full bg-[#f7f2ea] flex items-center justify-center text-[#b88a4f] border border-[#e6dccf]">
                      <SakeenahLineSpinner size={16} color="#b88a4f" label="جارٍ تنزيل المؤذن" />
                    </div>
                  ) : isDownloaded ? (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(track, e)}
                      className="w-8.5 h-8.5 rounded-full bg-[#f7f2ea] hover:bg-rose-50 text-rose-500 hover:text-rose-600 flex items-center justify-center border border-[#e6dccf] transition-colors"
                      title="حذف الملف المحفوظ"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleDownload(track, e)}
                      className="w-8.5 h-8.5 rounded-full bg-white hover:bg-[#f7f2ea] text-[#7f6a55] flex items-center justify-center border border-[#e6dccf] transition-colors"
                      title="حفظ للاستخدام دون إنترنت"
                    >
                      <Download size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
