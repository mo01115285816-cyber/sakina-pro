import { useEffect, useState } from 'react';
import { QcfFontStorage } from '@/services/QcfFontStorage';

const loadedFonts = new Map<string, string>();
const TOTAL_PAGES = 604;
const PREFETCH_BATCH_SIZE = 20; // تحميل 20 خط في المرة لتجنب memory spike
let prefetchPromise: Promise<void> | null = null;
let isPrefetched = false;

export function prefetchQcfFont(pageNumber: number): void {
  const family = QcfFontStorage.fontId(pageNumber);
  if (loadedFonts.has(family)) return;
  QcfFontStorage.readFontAsBlobUrl(pageNumber)
    .then((url) => {
      const fontFace = new FontFace(family, `url(${url}) format('woff2')`, { display: 'block' });
      fontFace.load().then((loaded) => {
        document.fonts.add(loaded);
        loadedFonts.set(family, url);
      });
    })
    .catch(() => {});
}

export function useQcfFont(pageNumber: number): boolean {
  const fontFamily = pageNumber >= 1 && pageNumber <= 604 ? QcfFontStorage.fontId(pageNumber) : null;
  const [isLoaded, setIsLoaded] = useState<boolean>(() => (fontFamily ? loadedFonts.has(fontFamily) : false));

  useEffect(() => {
    if (!fontFamily) return;
    if (loadedFonts.has(fontFamily)) {
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    setIsLoaded(false);

    QcfFontStorage.readFontAsBlobUrl(pageNumber)
      .then(async (url) => {
        const fontFace = new FontFace(fontFamily, `url(${url}) format('woff2')`, { display: 'block' });
        const loaded = await fontFace.load();
        document.fonts.add(loaded);
        loadedFonts.set(family, url);
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) console.error(`فشل جلب أو تركيب خط الصفحة ${pageNumber}:`, err);
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, fontFamily]);

  return isLoaded;
}

export function isQcfFontLoaded(pageNumber: number): boolean {
  if (!pageNumber || pageNumber < 1 || pageNumber > 604) return false;
  return loadedFonts.has(QcfFontStorage.fontId(pageNumber));
}

export function areFontsExtracted(): Promise<boolean> {
  return QcfFontStorage.isExtracted();
}

/**
 * تحميل كل خطوط المصحف الـ 604 في الذاكرة مسبقاً (prefetch).
 *
 * هذا هو الحل القوي الذي تستخدمه التطبيقات العالمية للقرآن:
 * بعد اكتمال تنزيل الخطوط، تُحمَّل كل الخطوط في document.fonts
 * مرة واحدة، بحيث عند فتح أي صفحة لا يظهر للمستخدم أي "جاري تحميل".
 *
 * الذاكرة المستهلكة: ~24 ميجابايت (604 خط × ~40 كيلوبايت لكل خط).
 * هذا مقبول جداً لتطبيق قرآني احترافي.
 *
 * @param onProgress دالة تُستدعى لتتبع التقدم (0-100)
 * @returns Promise يكتمل عند تحميل كل الخطوط
 */
export async function prefetchAllQcfFonts(
  onProgress?: (percent: number, status: string) => void
): Promise<void> {
  // إذا تم التحميل المسبق بالفعل، لا تفعل شيئاً
  if (isPrefetched) {
    onProgress?.(100, 'خطوط المصحف جاهزة في الذاكرة');
    return;
  }

  // إذا كان التحميل المسبق جارياً بالفعل، انتظر اكتماله
  if (prefetchPromise) {
    return prefetchPromise;
  }

  prefetchPromise = (async () => {
    onProgress?.(0, 'جاري تجهيز خطوط المصحف في الذاكرة...');

    for (let batchStart = 1; batchStart <= TOTAL_PAGES; batchStart += PREFETCH_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PREFETCH_BATCH_SIZE - 1, TOTAL_PAGES);
      const batchPromises: Promise<void>[] = [];

      for (let page = batchStart; page <= batchEnd; page++) {
        batchPromises.push(prefetchSingleFont(page));
      }

      await Promise.all(batchPromises);

      const percent = Math.floor((batchEnd / TOTAL_PAGES) * 100);
      onProgress?.(percent, `تم تجهيز ${batchEnd} صفحة من خطوط المصحف...`);
    }

    isPrefetched = true;
    onProgress?.(100, 'اكتمل تجهيز كل خطوط المصحف في الذاكرة');
  })();

  try {
    await prefetchPromise;
  } finally {
    prefetchPromise = null;
  }
}

async function prefetchSingleFont(pageNumber: number): Promise<void> {
  const family = QcfFontStorage.fontId(pageNumber);
  if (loadedFonts.has(family)) return;

  try {
    const url = await QcfFontStorage.readFontAsBlobUrl(pageNumber);
    const fontFace = new FontFace(family, `url(${url}) format('woff2')`, { display: 'block' });
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    loadedFonts.set(family, url);
  } catch {
    // تخطّي الخطوط الفاشلة صامتاً — ستُحاول useQcfFont مرة أخرى عند فتح الصفحة
  }
}

/**
 * تحقق مما إذا كانت كل الخطوط محمّلة في الذاكرة مسبقاً.
 */
export function isFontsPrefetched(): boolean {
  return isPrefetched;
}
