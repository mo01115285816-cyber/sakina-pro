import type { Moshaf, Reciter } from "@/types/quran";

export interface QuranVerseTimestamp {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
  duration?: number;
  segments?: Array<[number, number, number] | [number]>;
}

export interface QuranChapterAudioSource {
  audioUrl: string;
  fallbackUrl: string;
  timestamps: QuranVerseTimestamp[];
  recitationId: number | null;
  moshaf: Moshaf;
}

const API_BASE_URL = "https://api.quran.com/api/v4";
const chapterAudioCache = new Map<string, Promise<QuranChapterAudioSource | null>>();
const ALL_SURAHS = Array.from({ length: 114 }, (_, index) => index + 1).join(",");

/**
 * A small, real fallback catalog keeps the reader usable while the official
 * mp3quran catalog is loading or temporarily unavailable.
 */
export const READER_FALLBACK_RECITERS: Reciter[] = [
  {
    id: 111,
    name: "مشاري راشد العفاسي",
    letter: "م",
    moshaf: [{ id: 1, name: "حفص عن عاصم - مرتل", server: "https://server8.mp3quran.net/afs/", surah_total: 114, surah_list: ALL_SURAHS }],
  },
  {
    id: 86,
    name: "محمد صديق المنشاوي",
    letter: "م",
    moshaf: [{ id: 2, name: "حفص عن عاصم - مرتل", server: "https://server10.mp3quran.net/minsh/", surah_total: 114, surah_list: ALL_SURAHS }],
  },
  {
    id: 54,
    name: "عبد الباسط عبد الصمد",
    letter: "ع",
    moshaf: [{ id: 3, name: "حفص عن عاصم - مرتل", server: "https://server7.mp3quran.net/basit/", surah_total: 114, surah_list: ALL_SURAHS }],
  },
  {
    id: 90,
    name: "محمود خليل الحصري",
    letter: "م",
    moshaf: [{ id: 4, name: "حفص عن عاصم - مرتل", server: "https://server13.mp3quran.net/husr/", surah_total: 114, surah_list: ALL_SURAHS }],
  },
  {
    id: 15,
    name: "عبد الرحمن السديس",
    letter: "ع",
    moshaf: [{ id: 5, name: "حفص عن عاصم - مرتل", server: "https://server11.mp3quran.net/sds/", surah_total: 114, surah_list: ALL_SURAHS }],
  },
];

function supportsSurah(moshaf: Moshaf, surahId: number): boolean {
  return moshaf.surah_list
    .split(",")
    .map(Number)
    .some((id) => id === surahId);
}

export function getMoshafForSurah(reciter: Reciter, surahId: number): Moshaf | null {
  return reciter.moshaf.find((moshaf) => supportsSurah(moshaf, surahId)) ?? reciter.moshaf[0] ?? null;
}

export function getMoshafSurahUrl(moshaf: Moshaf, surahId: number): string {
  return `${moshaf.server}${String(surahId).padStart(3, "0")}.mp3`;
}

export function getFoundationRecitationId(reciterName: string, moshafName: string): number | null {
  const name = reciterName.replace(/[ـ]/g, "").trim();
  const style = moshafName.replace(/[ـ]/g, "").trim();

  if (name.includes("العفاسي") || name.includes("مشاري")) return 7;
  if (name.includes("عبد الباسط") || name.includes("عبدالباسط")) return style.includes("مجود") ? 1 : 2;
  if (name.includes("السديس")) return 3;
  if (name.includes("الشاطري")) return 4;
  if (name.includes("هاني الرفاعي") || name.includes("هاني الرفاعى")) return 5;
  if (name.includes("الحصري") || name.includes("الحصرى")) return style.includes("معلم") ? 12 : 6;
  if (name.includes("المنشاوي") || name.includes("المنشاوى")) return style.includes("مجود") ? 8 : 9;
  if (name.includes("شريم")) return 10;
  if (name.includes("الطبلاوي") || name.includes("الطبلاوى")) return 11;
  return null;
}

export function supportsSyncedRecitation(reciter: Reciter, surahId: number): boolean {
  const moshaf = getMoshafForSurah(reciter, surahId);
  return Boolean(moshaf && getFoundationRecitationId(reciter.name, moshaf.name) !== null);
}

function isValidTimestamp(value: unknown): value is QuranVerseTimestamp {
  if (!value || typeof value !== "object") return false;
  const timestamp = value as Partial<QuranVerseTimestamp>;
  return (
    typeof timestamp.verse_key === "string" &&
    /^\d{1,3}:\d{1,3}$/.test(timestamp.verse_key) &&
    typeof timestamp.timestamp_from === "number" &&
    typeof timestamp.timestamp_to === "number" &&
    timestamp.timestamp_to >= timestamp.timestamp_from
  );
}

export async function resolveQuranChapterAudio(
  reciter: Reciter,
  surahId: number,
): Promise<QuranChapterAudioSource | null> {
  const cacheKey = `${reciter.id}:${surahId}`;
  const cached = chapterAudioCache.get(cacheKey);
  if (cached) return cached;

  const request = resolveQuranChapterAudioUncached(reciter, surahId);
  chapterAudioCache.set(cacheKey, request);
  return request;
}

async function resolveQuranChapterAudioUncached(
  reciter: Reciter,
  surahId: number,
): Promise<QuranChapterAudioSource | null> {
  const moshaf = getMoshafForSurah(reciter, surahId);
  if (!moshaf?.server) return null;

  const fallbackUrl = getMoshafSurahUrl(moshaf, surahId);
  const recitationId = getFoundationRecitationId(reciter.name, moshaf.name);
  if (recitationId === null) {
    return { audioUrl: fallbackUrl, fallbackUrl, timestamps: [], recitationId: null, moshaf };
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/chapter_recitations/${recitationId}/${surahId}?segments=true`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(`QURAN_AUDIO_API_${response.status}`);
    const payload = await response.json() as {
      audio_file?: {
        audio_url?: unknown;
        timestamps?: unknown;
      };
    };
    const audioUrl = payload.audio_file?.audio_url;
    const timestamps = Array.isArray(payload.audio_file?.timestamps)
      ? payload.audio_file.timestamps.filter(isValidTimestamp)
      : [];
    if (typeof audioUrl !== "string" || !audioUrl.startsWith("http") || timestamps.length === 0) {
      throw new Error("QURAN_AUDIO_TIMING_DATA_INVALID");
    }
    return { audioUrl, fallbackUrl, timestamps, recitationId, moshaf };
  } catch (error) {
    console.warn("Quran Foundation timing data unavailable; using the selected reciter file", error);
    return { audioUrl: fallbackUrl, fallbackUrl, timestamps: [], recitationId, moshaf };
  }
}
