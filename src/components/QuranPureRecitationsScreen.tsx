import { useEffect, useMemo, useState } from "react";
import { ChevronRight, BookOpenText, RefreshCw, WifiOff } from "lucide-react";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import QuranSurahsScreen from "@/components/QuranSurahsScreen";
import type { Moshaf, Reciter } from "@/types/quran";
import { publicAssetUrl } from "@/utils/publicAssetUrl";
import { getSmartCache, isSmartCacheStale, setSmartCache } from "@/services/smart-cache";

const CATALOG_URL =
  "https://mo01115285816-cyber.github.io/quran-audio/catalog/manifest.json";
const PURE_RECITATIONS_CACHE_KEY = "sakina:cache:pure-recitations:v1";
const PURE_RECITATIONS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const RECITER_IMAGE_PATHS: Record<string, string> = {
  "mohammed-siddiq-al-minshawi": publicAssetUrl(
    "images/quran-recitation/mohammed-siddiq-al-minshawi.webp",
  ),
  "ahmed-bin-taleb": publicAssetUrl(
    "images/quran-recitation/ahmed-bin-taleb.jpg",
  ),
  "muhammad-ayyub": publicAssetUrl(
    "images/quran-recitation/muhammad-ayyub.jpg",
  ),
  "abdullah-abdulmohsen-al-qarafi": publicAssetUrl(
    "images/quran-recitation/abdullah-abdulmohsen-al-qarafi.jpg",
  ),
  "mishary-rashid-al-afasy": publicAssetUrl(
    "images/quran-recitation/mishary-rashid-al-afasy.jpg",
  ),
};

// Profile facts are intentionally brief and sourced from verified institutional or reference pages:
// Minshawi — BBC Arabic; Ahmad bin Taleb — Manarat Al-Haramain; Abdullah Al-Qarafi — Presidency of Religious Affairs;
// Mishary Alafasy — Midad scholar profile. Muhammad Ayyub is limited to his documented role as a Saudi reciter and imam.
const PURE_RECITER_PROFILE_META: Record<string, {
  bioShort: string;
  country: string;
  countryFlag: string;
}> = {
  "mohammed-siddiq-al-minshawi": {
    bioShort: "قارئ مصري من رواد التلاوة الإذاعية، عُرف بصوته الخاشع وتسجيلاته القرآنية المؤثرة.",
    country: "مصر",
    countryFlag: "🇪🇬",
  },
  "ahmed-bin-taleb": {
    bioShort: "قارئ وإمام سعودي، ومن أئمة المسجد النبوي الشريف سابقًا.",
    country: "السعودية",
    countryFlag: "🇸🇦",
  },
  "muhammad-ayyub": {
    bioShort: "قارئ وإمام سعودي، ومن أئمة المسجد النبوي الشريف.",
    country: "السعودية",
    countryFlag: "🇸🇦",
  },
  "abdullah-abdulmohsen-al-qarafi": {
    bioShort: "قارئ وإمام سعودي، إمام المسجد النبوي وعضو هيئة التدريس بالجامعة الإسلامية بالمدينة المنورة.",
    country: "السعودية",
    countryFlag: "🇸🇦",
  },
  "mishary-rashid-al-afasy": {
    bioShort: "قارئ وإمام وخطيب كويتي، درس القراءات والتفسير بالجامعة الإسلامية بالمدينة المنورة.",
    country: "الكويت",
    countryFlag: "🇰🇼",
  },
};

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
  photoUrl?: string;
  tracks: PureAudioTrack[];
};

export type PureAudioCatalog = {
  version: string;
  generatedAt?: string;
  source?: string;
  reciters: PureAudioReciter[];
};

interface Props {
  isActive?: boolean;
  onBack: () => void;
  onPlayTrack: (
    reciter: PureAudioReciter,
    track: PureAudioTrack,
    playlist: PureAudioTrack[],
  ) => void;
  currentlyPlayingId?: number;
  isPlaying?: boolean;
  onTriggerTimer?: () => void;
  onReadSurah?: (surahId: number) => void;
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
    return [{
      id,
      name,
      folder,
      description: typeof value.description === "string" ? value.description : undefined,
      photoUrl: RECITER_IMAGE_PATHS[id],
      tracks,
    }];
  });

  return {
    version: String(source.version ?? "1"),
    generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : undefined,
    source: typeof source.source === "string" ? source.source : undefined,
    reciters,
  };
}

function toStableReciterId(id: string) {
  return Math.abs(Array.from(id).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)) || 1;
}

function getCachedPureCatalog() {
  return getSmartCache<PureAudioCatalog>(PURE_RECITATIONS_CACHE_KEY)?.data ?? null;
}

export default function QuranPureRecitationsScreen({
  isActive = true,
  onBack,
  onPlayTrack,
  currentlyPlayingId,
  isPlaying = false,
  onTriggerTimer,
  onReadSurah,
}: Props) {
  const [catalog, setCatalog] = useState<PureAudioCatalog | null>(() => getCachedPureCatalog());
  const [selectedReciterId, setSelectedReciterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => !getCachedPureCatalog());
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = async () => {
    const hasVisibleCatalog = Boolean(getCachedPureCatalog() || catalog);
    setIsLoading(!hasVisibleCatalog);
    setError(null);
    try {
      const response = await fetch(CATALOG_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      const payload = normalizeCatalog(await response.json());
      setSmartCache(PURE_RECITATIONS_CACHE_KEY, payload);
      setCatalog(payload);
      setSelectedReciterId((current) =>
        current && payload.reciters.some((reciter) => reciter.id === current) ? current : null,
      );
    } catch (loadError) {
      console.error("Failed to load pure recitations catalog", loadError);
      if (!hasVisibleCatalog) setError("لم يتم نشر كتالوج التلاوات النقية حتى الآن.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    const cached = getSmartCache<PureAudioCatalog>(PURE_RECITATIONS_CACHE_KEY);
    if (cached && !isSmartCacheStale(cached, PURE_RECITATIONS_CACHE_MAX_AGE_MS)) {
      setIsLoading(false);
      return;
    }
    void loadCatalog();
  }, [isActive]);

  const selectedReciter = useMemo(
    () => catalog?.reciters.find((reciter) => reciter.id === selectedReciterId) ?? null,
    [catalog, selectedReciterId],
  );

  const profileReciter = useMemo<Reciter | null>(() => {
    if (!selectedReciter) return null;
    const profileMeta = PURE_RECITER_PROFILE_META[selectedReciter.id];
    return {
      id: toStableReciterId(selectedReciter.id),
      name: selectedReciter.name,
      letter: selectedReciter.name.trim().charAt(0),
      photoUrl: selectedReciter.photoUrl,
      bioShort: selectedReciter.description ?? profileMeta?.bioShort,
      country: profileMeta?.country,
      countryFlag: profileMeta?.countryFlag,
      moshaf: [],
    };
  }, [selectedReciter]);

  const profileMoshaf = useMemo<Moshaf | null>(() => {
    if (!selectedReciter || !profileReciter) return null;
    return {
      id: profileReciter.id,
      name: "تلاوة نقية",
      server: "",
      surah_total: selectedReciter.tracks.length,
      surah_list: selectedReciter.tracks.map((track) => track.surahId).join(","),
    };
  }, [profileReciter, selectedReciter]);

  const handleBack = () => {
    if (selectedReciterId) {
      setSelectedReciterId(null);
      return;
    }
    onBack();
  };

  return (
    <div className="min-h-screen bg-[#ece7de] text-[#2b1a10] flex flex-col font-sans relative overflow-hidden" dir="rtl">
      <div className="absolute top-0 right-0 w-full h-[320px] bg-gradient-to-b from-[#b88a4f]/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-[-12%] left-[-14%] w-[280px] h-[280px] bg-[#deab65]/10 rounded-full blur-[110px] pointer-events-none" />

      <header className="fixed top-6 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
        <div className="cut-crystal-capsule rounded-full px-4 h-10 flex items-center gap-2 shadow-md pointer-events-auto">
          <BookOpenText size={16} className="text-[#b88a4f]" />
          <span className="text-[14px] font-bold">التلاوات النقية</span>
        </div>
        <button
          type="button"
          onClick={handleBack}
          aria-label={selectedReciter ? "العودة إلى القراء" : "الخروج إلى صفحة الاستماع"}
          className="w-10 h-10 cut-crystal-capsule rounded-full flex items-center justify-center shadow-md text-[#2b1a10] active:scale-95 transition-transform pointer-events-auto"
        >
          <ChevronRight size={20} />
        </button>
      </header>

      <main className={selectedReciter ? "flex-1 relative z-10" : "flex-1 overflow-y-auto hide-scrollbar pt-24 pb-36 relative z-10"}>
        {!selectedReciter && (
          <section className="px-6 pt-4 pb-7">
            <div className="max-w-[340px] mr-auto text-right">
              <p className="text-[11px] font-bold text-[#b88a4f] mb-1.5">اختيارات سكينة</p>
              <h1 className="text-[23px] font-bold leading-tight text-[#2b1a10]">تلاوات نقية ومنتقاة</h1>
              <p className="text-[13px] text-[#7f6a55] font-bold leading-relaxed mt-2">
                تسجيلات مستقلة بجودة مراجَعة من مكتبة سكينة الخاصة.
              </p>
            </div>
          </section>
        )}

        {isLoading && !catalog ? (
          <div className="px-6 py-16 text-center flex flex-col items-center gap-3">
            <SakeenahLineSpinner size={40} color="#b88a4f" label="جارٍ تحميل كتالوج التلاوات النقية" />
            <p className="text-[13px] text-[#7f6a55] font-bold">جاري تجهيز مكتبة التلاوات...</p>
          </div>
        ) : error && !catalog ? (
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
            {!selectedReciter ? (
              <section className="px-6 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[16px] font-bold">اختر القارئ</h2>
                  <span className="text-[11px] text-[#7f6a55] font-bold">{catalog.reciters.length} قراء</span>
                </div>
                <div className="space-y-3.5">
                  {catalog.reciters.map((reciter) => {
                    const imageUrl = reciter.photoUrl;
                    return (
                      <button
                        type="button"
                        key={reciter.id}
                        onClick={() => setSelectedReciterId(reciter.id)}
                        className="w-full rounded-[28px] p-4.5 flex items-center justify-between group active:scale-[0.98] transition-all duration-200 shadow-md text-right cut-crystal-panel"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative w-12 h-12 shrink-0 rounded-full cut-crystal-panel p-1 text-white">
                            <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-[#deab65] to-[#b88a4f] flex items-center justify-center">

                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`صورة ${reciter.name}`}
                                width={48}
                                height={48}
                                loading="eager"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[20px] font-bold font-serif">{reciter.name.trim().charAt(0)}</span>
                            )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[17px] font-bold leading-tight mb-1.5 truncate text-[#2b1a10] group-hover:text-[#b88a4f]">
                              {reciter.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[12px] text-[#7f6a55] font-bold">
                              <BookOpenText size={12} className="text-[#b88a4f]" />
                              <span>تلاوة نقية · {reciter.tracks.length} سورة</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-[#b88a4f] opacity-80 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : profileReciter && profileMoshaf ? (
              <QuranSurahsScreen
                reciter={profileReciter}
                moshaf={profileMoshaf}
                onBack={handleBack}
                onPlaySurah={(surahId, allSurahs) => {
                  const track = selectedReciter?.tracks.find((item) => item.surahId === surahId);
                  if (selectedReciter && track) {
                    onPlayTrack(selectedReciter, track, allSurahs.map((id) => selectedReciter.tracks.find((item) => item.surahId === id)).filter((item): item is PureAudioTrack => Boolean(item)));
                  }
                }}
                currentlyPlayingId={currentlyPlayingId}
                isPlaying={isPlaying}
                onTriggerTimer={onTriggerTimer}
                onReadSurah={onReadSurah}
                resolveSurahUrl={(surahId) => selectedReciter?.tracks.find((track) => track.surahId === surahId)?.url ?? ""}
                showHeader={false}
        showPortfolioHero
              />
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
