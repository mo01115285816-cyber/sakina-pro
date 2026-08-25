import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronRight,
  BookOpenText,
  Download,
  FolderDown,
  Play,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { surahNames } from "@/data/surahNames";
import { vocalizedSurahNames } from "@/data/vocalizedSurahNames";

const CATALOG_URL =
  "https://mo01115285816-cyber.github.io/quran-audio/catalog/manifest.json";

export type PureAudioTrack = {
  surahId: number;
  url: string;
  format?: string;
  bitrateKbps?: number;
  durationSeconds?: number;
  sizeBytes?: number;
};

export type PureAudioReciter = {
  id: string;
  name: string;
  folder: string;
  description?: string;
  tracks: PureAudioTrack[];
};

export type PureAudioCatalog = {
  version: string;
  generatedAt?: string;
  source?: string;
  reciters: PureAudioReciter[];
};

interface Props {
  onBack: () => void;
  onPlayTrack: (
    reciter: PureAudioReciter,
    track: PureAudioTrack,
    playlist: PureAudioTrack[],
  ) => void;
}

function normalizeTrack(
  raw: Record<string, unknown>,
  reciterFolder: string,
): PureAudioTrack | null {
  const surahId = Number(raw.surahId ?? raw.surah_id ?? raw.surah ?? raw.id);
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) return null;

  const file = typeof raw.file === "string" ? raw.file : null;
  const rawUrl = typeof raw.url === "string" ? raw.url : null;
  const url =
    rawUrl ||
    (file
      ? `https://mo01115285816-cyber.github.io/quran-audio/audio/reciters/${encodeURIComponent(reciterFolder)}/${file}`
      : null);
  if (!url) return null;

  return {
    surahId,
    url,
    format: typeof raw.format === "string" ? raw.format : undefined,
    bitrateKbps: Number.isFinite(Number(raw.bitrateKbps))
      ? Number(raw.bitrateKbps)
      : undefined,
    durationSeconds: Number.isFinite(Number(raw.durationSeconds))
      ? Number(raw.durationSeconds)
      : undefined,
    sizeBytes: Number.isFinite(Number(raw.sizeBytes))
      ? Number(raw.sizeBytes)
      : undefined,
  };
}

function normalizeCatalog(raw: unknown): PureAudioCatalog {
  const source = raw as Record<string, unknown>;
  const rawReciters = Array.isArray(source.reciters) ? source.reciters : [];
  const reciters = rawReciters.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const id = String(value.id ?? value.slug ?? "").trim();
    const name = String(value.name ?? value.displayName ?? "").trim();
    const folder = String(value.folder ?? value.slug ?? id).trim();
    if (!id || !name || !folder) return [];

    const rawTracks = Array.isArray(value.tracks)
      ? value.tracks
      : Array.isArray(value.surahs)
        ? value.surahs
        : [];
    const tracks = rawTracks
      .filter((track): track is Record<string, unknown> => Boolean(track && typeof track === "object"))
      .map((track) => normalizeTrack(track, folder))
      .filter((track): track is PureAudioTrack => Boolean(track))
      .sort((a, b) => a.surahId - b.surahId);
    return [{ id, name, folder, description: typeof value.description === "string" ? value.description : undefined, tracks }];
  });

  return {
    version: String(source.version ?? "1"),
    generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : undefined,
    source: typeof source.source === "string" ? source.source : undefined,
    reciters,
  };
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export default function QuranPureRecitationsScreen({ onBack, onPlayTrack }: Props) {
  const [catalog, setCatalog] = useState<PureAudioCatalog | null>(null);
  const [selectedReciterId, setSelectedReciterId] = useState<string | null>(null);
  const [downloadedUrls, setDownloadedUrls] = useState<Set<string>>(new Set());
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(CATALOG_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      const payload = normalizeCatalog(await response.json());
      setCatalog(payload);
      setSelectedReciterId((current) => current ?? payload.reciters[0]?.id ?? null);
    } catch (loadError) {
      console.error("Failed to load pure recitations catalog", loadError);
      setError("لم يتم نشر كتالوج التلاوات النقية حتى الآن.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const selectedReciter = useMemo(
    () => catalog?.reciters.find((reciter) => reciter.id === selectedReciterId) ?? null,
    [catalog, selectedReciterId],
  );

  useEffect(() => {
    let cancelled = false;
    const checkDownloads = async () => {
      if (!selectedReciter) return;
      const { isAudioDownloaded } = await import("@/utils/audioCache");
      const entries = await Promise.all(
        selectedReciter.tracks.map(async (track) =>
          (await isAudioDownloaded(track.url)) ? track.url : null,
        ),
      );
      if (!cancelled) setDownloadedUrls(new Set(entries.filter((url): url is string => Boolean(url))));
    };
    void checkDownloads();
    return () => {
      cancelled = true;
    };
  }, [selectedReciter]);

  const handleDownload = async (track: PureAudioTrack) => {
    if (downloadedUrls.has(track.url) || downloadingUrl) return;
    setDownloadingUrl(track.url);
    try {
      const { downloadAudioFile } = await import("@/utils/audioCache");
      await downloadAudioFile(track.url);
      setDownloadedUrls((current) => new Set(current).add(track.url));
    } catch (downloadError) {
      console.error("Failed to download pure recitation", downloadError);
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#ece7de] text-[#2b1a10] flex flex-col font-sans relative overflow-hidden" dir="rtl">
      <div className="absolute top-0 right-0 w-full h-[320px] bg-gradient-to-b from-[#b88a4f]/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-14%] w-[280px] h-[280px] bg-[#deab65]/10 rounded-full blur-[110px] pointer-events-none" />

      <header className="fixed top-6 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={onBack}
          aria-label="العودة إلى صفحة الاستماع"
          className="w-10 h-10 cut-crystal-capsule rounded-full flex items-center justify-center shadow-md text-[#2b1a10] active:scale-95 transition-transform pointer-events-auto"
        >
          <ChevronRight size={20} />
        </button>
        <div className="cut-crystal-capsule rounded-full px-4 h-10 flex items-center gap-2 shadow-md pointer-events-auto">
          <BookOpenText size={16} className="text-[#b88a4f]" />
          <span className="text-[14px] font-bold">التلاوات النقية</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pt-24 pb-36 relative z-10">
        <section className="px-6 pb-6">
          <div className="cut-crystal-panel rounded-[30px] p-5 shadow-md border border-[#deab65]/20">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white flex items-center justify-center shrink-0 shadow-sm">
                <BookOpenText size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#b88a4f] mb-1">اختيارات سكينة</p>
                <h1 className="text-[22px] font-bold leading-tight">تلاوات نقية ومنتقاة</h1>
                <p className="text-[13px] text-[#7f6a55] font-bold leading-relaxed mt-2">
                  تسجيلات مستقلة بجودة مراجَعة، تُدار من مكتبة سكينة الخاصة دون خلطها بالمصدر العام.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#2b1a10]/10 flex items-center justify-between text-[11px] text-[#7f6a55] font-bold">
              <span>{catalog ? `إصدار الكتالوج ${catalog.version}` : "مكتبة خاصة"}</span>
              <span>{selectedReciter ? `${selectedReciter.tracks.length} سورة متاحة` : "تُحدّث تلقائيًا"}</span>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="px-6 py-16 text-center flex flex-col items-center gap-3">
            <SakeenahLineSpinner size={40} color="#b88a4f" label="جارٍ تحميل كتالوج التلاوات النقية" />
            <p className="text-[13px] text-[#7f6a55] font-bold">جاري تجهيز مكتبة التلاوات...</p>
          </div>
        ) : error || !catalog || catalog.reciters.length === 0 ? (
          <section className="px-6 py-8">
            <div className="cut-crystal-panel rounded-[28px] p-6 text-center shadow-sm">
              <WifiOff size={25} className="mx-auto text-[#b88a4f] mb-3" />
              <h2 className="text-[17px] font-bold mb-2">المكتبة قيد التجهيز</h2>
              <p className="text-[13px] text-[#7f6a55] font-bold leading-relaxed">{error ?? "لم تُنشر ملفات صوتية معتمدة بعد."}</p>
              <button
                type="button"
                onClick={() => void loadCatalog()}
                className="mt-5 cut-crystal-capsule rounded-full px-5 py-2.5 text-[13px] font-bold text-[#b88a4f] inline-flex items-center gap-2 active:scale-95 transition-transform"
              >
                <RefreshCw size={15} />
                إعادة المحاولة
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="px-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[16px] font-bold">اختر القارئ</h2>
                <span className="text-[11px] text-[#7f6a55] font-bold">{catalog.reciters.length} قراء</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
                {catalog.reciters.map((reciter) => {
                  const active = selectedReciterId === reciter.id;
                  return (
                    <button
                      type="button"
                      key={reciter.id}
                      onClick={() => setSelectedReciterId(reciter.id)}
                      className={`shrink-0 min-w-[150px] rounded-[22px] p-3 text-right transition-all active:scale-[0.98] ${active ? "bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white shadow-md" : "cut-crystal-panel text-[#2b1a10] shadow-sm"}`}
                    >
                      <div className={`w-9 h-9 rounded-[14px] flex items-center justify-center font-bold text-[16px] mb-2 ${active ? "bg-white/20" : "bg-[#b88a4f]/10 text-[#b88a4f]"}`}>
                        {reciter.name.trim().charAt(0)}
                      </div>
                      <p className="text-[13px] font-bold truncate">{reciter.name}</p>
                      <p className={`text-[10px] font-bold mt-1 ${active ? "text-white/75" : "text-[#7f6a55]"}`}>{reciter.tracks.length} سورة</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedReciter && (
              <section className="px-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-[18px] font-bold">سور {selectedReciter.name}</h2>
                    <p className="text-[11px] text-[#7f6a55] font-bold mt-1">اضغط على السورة للتشغيل الفوري</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedReciter.tracks.forEach((track) => void handleDownload(track))}
                    className="cut-crystal-capsule rounded-full px-3 py-2 text-[11px] font-bold text-[#b88a4f] inline-flex items-center gap-1.5 active:scale-95 transition-transform"
                    title="تنزيل السور المتاحة"
                  >
                    <FolderDown size={14} />
                    تنزيل الكل
                  </button>
                </div>
                <div className="space-y-2.5">
                  {selectedReciter.tracks.map((track, index) => {
                    const isDownloaded = downloadedUrls.has(track.url);
                    const isDownloading = downloadingUrl === track.url;
                    return (
                      <motion.div
                        key={`${selectedReciter.id}-${track.surahId}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 8) * 0.025, duration: 0.18 }}
                        className="cut-crystal-panel rounded-[22px] px-4 py-3 flex items-center gap-3 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => onPlayTrack(selectedReciter, track, selectedReciter.tracks)}
                          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#deab65] to-[#b88a4f] text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                          aria-label={`تشغيل ${surahNames[track.surahId] ?? `سورة ${track.surahId}`}`}
                        >
                          <Play size={17} fill="currentColor" />
                        </button>
                        <div className="min-w-0 flex-1 text-right">
                          <p className="text-[15px] font-bold truncate">{vocalizedSurahNames[track.surahId] ?? `سُورَةُ ${surahNames[track.surahId] ?? track.surahId}`}</p>
                          <p className="text-[10px] text-[#7f6a55] font-bold mt-1">
                            {track.format?.toUpperCase() ?? "صوت"}{track.bitrateKbps ? ` · ${track.bitrateKbps} كيلوبت` : ""}{formatSize(track.sizeBytes) ? ` · ${formatSize(track.sizeBytes)}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDownload(track)}
                          disabled={isDownloading}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${isDownloaded ? "text-[#b88a4f] bg-[#b88a4f]/10" : "text-[#7f6a55] hover:bg-[#b88a4f]/10"}`}
                          aria-label={isDownloaded ? "متاحة بدون إنترنت" : `تنزيل ${surahNames[track.surahId] ?? "السورة"}`}
                        >
                          {isDownloading ? <SakeenahLineSpinner size={32} color="#b88a4f" label="جارٍ تنزيل السورة" /> : isDownloaded ? <Smartphone size={16} /> : <Download size={16} />}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
