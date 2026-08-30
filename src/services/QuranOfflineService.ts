import localforage from 'localforage';
import { MushafLayoutService } from './MushafLayoutService';
import { QcfFontStorage } from './QcfFontStorage';

const TAFSIR_VERSION_KEY = 'quran_tafsir_version';
const TAFSIR_VERSION = 'ibn-kathir-v1';
const TAFSIR_API_BASE = 'https://api.quran.com/api/v4';
const TAFSIR_RESOURCE_ID = 14;
const TAFSIR_RESOURCE_SLUG = 'ar-tafsir-ibn-kathir';
const TAFSIR_RESOURCE_NAME = 'تفسير ابن كثير';
const TOTAL_PAGES = 604;
const REQUEST_RETRIES = 4;

export interface QuranTafsirEntry {
  id?: number;
  resource_id: number;
  verse_key: string;
  text: string;
  slug?: string;
  page_number?: number;
  chapter_id?: number;
  verse_number?: number;
}

const tafsirStore = localforage.createInstance({
  name: 'quran_db',
  storeName: 'tafsirs',
  description: 'Offline Tafsir Pages',
});

const metaStore = localforage.createInstance({
  name: 'quran_db',
  storeName: 'meta',
  description: 'Quran DB metadata',
});

function isTafsirEntry(value: unknown): value is QuranTafsirEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<QuranTafsirEntry>;
  return (
    entry.resource_id === TAFSIR_RESOURCE_ID &&
    typeof entry.verse_key === 'string' &&
    /^\d{1,3}:\d{1,3}$/.test(entry.verse_key) &&
    typeof entry.text === 'string' &&
    entry.text.trim().length > 0
  );
}

function normalizeTafsirEntries(value: unknown): QuranTafsirEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTafsirEntry);
}

function getRetryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('retry-after');
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(8000, retryAfterSeconds * 1000);
  }
  return Math.min(8000, 700 * 2 ** attempt);
}

async function fetchTafsirJson(path: string): Promise<unknown> {
  let lastError: unknown = new Error('تعذر جلب بيانات التفسير');

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await fetch(`${TAFSIR_API_BASE}${path}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP Tafsir:${response.status}`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }

    if (attempt < REQUEST_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, getRetryDelay(response, attempt)));
    }
  }

  throw lastError;
}

function extractPageEntries(payload: unknown): QuranTafsirEntry[] {
  if (!payload || typeof payload !== 'object') return [];
  const tafsirs = (payload as { tafsirs?: unknown }).tafsirs;
  return normalizeTafsirEntries(tafsirs);
}

function extractAyahEntry(payload: unknown, verseKey: string): QuranTafsirEntry | null {
  if (!payload || typeof payload !== 'object') return null;
  const tafsir = (payload as { tafsir?: unknown }).tafsir;
  return isTafsirEntry(tafsir) && tafsir.verse_key === verseKey ? tafsir : null;
}

export const QuranOfflineService = {
  tafsirStore,
  metaStore,
  tafsirResourceId: TAFSIR_RESOURCE_ID,
  tafsirResourceName: TAFSIR_RESOURCE_NAME,
  tafsirResourceSlug: TAFSIR_RESOURCE_SLUG,

  async isDownloaded(): Promise<boolean> {
    const tafsirVersion = await metaStore.getItem<string>(TAFSIR_VERSION_KEY);
    if (tafsirVersion !== TAFSIR_VERSION) return false;
    const mushafReady = await MushafLayoutService.isDownloaded();
    if (!mushafReady) return false;
    const tafsirsCount = await tafsirStore.length();
    if (tafsirsCount < TOTAL_PAGES) return false;

    // تحقق من الخطوط — بدون هذا، التطبيق يفتح القائمة كاذباً بعد فشل استخراج الخطوط.
    // السيناريو الخاطئ: لو فشلت extractFonts() بعد نجاح downloadTafsir()،
    // TAFSIR_VERSION_KEY يكون محفوظاً → isDownloaded() ترجع true → القائمة تفتح
    // → المستخدم يفتح سورة → readFontAsBlobUrl يفشل → "جاري تحميل خط المصحف" للأبد.
    // هذا التحقق يمنع هذا السيناريو الكارثي.
    const fontsReady = await QcfFontStorage.isExtracted();
    if (!fontsReady) return false;

    return true;
  },

  async getPage(pageNumber: number): Promise<any[] | null> {
    const page = await MushafLayoutService.getPage(pageNumber);
    if (!page) return null;
    return [page];
  },

  async getTafsirPage(pageNumber: number): Promise<QuranTafsirEntry[] | null> {
    const tafsirVersion = await metaStore.getItem<string>(TAFSIR_VERSION_KEY);
    if (tafsirVersion !== TAFSIR_VERSION) return null;
    const cached = normalizeTafsirEntries(await tafsirStore.getItem<unknown>(`tafsir_${pageNumber}`));
    return cached.length > 0 ? cached : null;
  },

  async getTafsirForAyah(verseKey: string): Promise<QuranTafsirEntry | null> {
    const [surah, ayah] = verseKey.split(':').map(Number);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1) {
      throw new Error('مفتاح الآية غير صالح');
    }

    const payload = await fetchTafsirJson(
      `/tafsirs/${TAFSIR_RESOURCE_ID}/by_ayah/${encodeURIComponent(verseKey)}?fields=verse_key,resource_name,language_name,id,chapter_id,verse_number,page_number`,
    );
    return extractAyahEntry(payload, verseKey);
  },

  async downloadTafsir(onProgress: (percent: number, statusText: string) => void): Promise<void> {
    let tafsirDownloaded = 0;
    onProgress(0, 'جاري التحقق من مصدر تفسير ابن كثير...');

    for (let i = 1; i <= TOTAL_PAGES; i += 10) {
      const pageNumbers = Array.from({ length: Math.min(10, TOTAL_PAGES - i + 1) }, (_, offset) => i + offset);
      await Promise.all(pageNumbers.map(async (pageNumber) => {
        const payload = await fetchTafsirJson(`/tafsirs/${TAFSIR_RESOURCE_ID}/by_page/${pageNumber}`);
        const entries = extractPageEntries(payload);
        if (entries.length === 0) throw new Error(`بيانات تفسير الصفحة ${pageNumber} غير صالحة`);
        if (entries.some((entry) => entry.resource_id !== TAFSIR_RESOURCE_ID)) {
          throw new Error(`مصدر تفسير غير متوقع في الصفحة ${pageNumber}`);
        }
        await tafsirStore.setItem(`tafsir_${pageNumber}`, entries);
      }));

      tafsirDownloaded += pageNumbers.length;
      const percent = Math.floor((tafsirDownloaded / TOTAL_PAGES) * 100);
      onProgress(percent, percent === 100 ? 'اكتمل حفظ تفسير ابن كثير محليًا' : `تم حفظ تفسير ${tafsirDownloaded} صفحة...`);
    }

    await metaStore.setItem(TAFSIR_VERSION_KEY, TAFSIR_VERSION);
  },

  async downloadQuran(onProgress: (percent: number, statusText: string) => void): Promise<void> {
    onProgress(0, 'جاري تجهيز بيانات المصحف...');

    await MushafLayoutService.downloadAll((layoutPercent, layoutStatus) => {
      onProgress(Math.floor(layoutPercent * 0.6), layoutStatus);
    });

    await QuranOfflineService.downloadTafsir((tafsirPercent, statusText) => {
      onProgress(60 + Math.floor(tafsirPercent * 0.4), statusText);
    });
  },

  async clearQuran(): Promise<void> {
    await Promise.all([
      tafsirStore.clear(),
      metaStore.clear(),
      MushafLayoutService.clearAll(),
    ]);
  },
};
