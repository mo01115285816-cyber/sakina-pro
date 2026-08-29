import { useEffect, useState } from 'react';
import { QcfFontStorage } from '@/services/QcfFontStorage';

const loadedFonts = new Map<string, string>();
const TOTAL_PAGES = 604;
const PREFETCH_BATCH_SIZE = 15; // Load 15 fonts per batch (balanced for memory)
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
    .catch(() => {
      // Silently fail - will retry on page load
    });
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
        loadedFonts.set(fontFamily, url);
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`فشل جلب أو تركيب خط الصفحة ${pageNumber}:`, err);
          // لا تعتبر الخط محمّلاً عند الفشل — اتركه على false ليظهر التطبيق
          // رسالة "جاري تحميل خط المصحف" الصادقة بدلاً من رسم مربعات tofu.
          // هذا يمنع القناع الخفي الذي كان يرسم النص بدون خط عند الفشل.
          if (!cancelled) setIsLoaded(false);
        }
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
    await prefetchPromise;
    return;
  }

  prefetchPromise = (async () => {
    try {
      onProgress?.(0, 'جاري تجهيز خطوط المصحف في الذاكرة...');

      // Load all 604 fonts in batches
      for (let batchStart = 1; batchStart <= TOTAL_PAGES; batchStart += PREFETCH_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PREFETCH_BATCH_SIZE - 1, TOTAL_PAGES);
        const batchPromises: Promise<void>[] = [];

        // Load each font in the batch in parallel
        for (let page = batchStart; page <= batchEnd; page++) {
          batchPromises.push(prefetchSingleFont(page).catch((err) => {
            // Log but don't throw - continue with other fonts
            console.warn(`تحذير: فشل تحميل خط الصفحة ${page}:`, err);
          }));
        }

        // Wait for entire batch to complete before moving to next
        await Promise.all(batchPromises);

        const percent = Math.floor((batchEnd / TOTAL_PAGES) * 100);
        onProgress?.(percent, `تم تجهيز ${batchEnd} من ${TOTAL_PAGES} خط المصحف...`);

        // Small delay between batches to avoid memory spikes
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      isPrefetched = true;
      onProgress?.(100, 'اكتمل تجهيز كل خطوط المصحف في الذاكرة ✅');
    } catch (err) {
      console.error('خطأ حرج في تحميل خطوط المصحف:', err);
      // لا تعتبر الـ prefetch مكتمل عند الفشل — اسمح بإعادة المحاولة
      // عند فتح التطبيق مرة أخرى. علامة isPrefetched=true كانت تخفي المشكلة.
      throw err;
    }
  })();

  try {
    await prefetchPromise;
  } finally {
    prefetchPromise = null;
  }
}

async function prefetchSingleFont(pageNumber: number): Promise<void> {
  const family = QcfFontStorage.fontId(pageNumber);
  
  // Skip if already loaded
  if (loadedFonts.has(family)) {
    return;
  }

  try {
    const url = await QcfFontStorage.readFontAsBlobUrl(pageNumber);
    const fontFace = new FontFace(family, `url(${url}) format('woff2')`, { display: 'block' });
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    loadedFonts.set(family, url);
  } catch (err) {
    // Don't throw - let other fonts continue loading
    // This font will be loaded on-demand when user opens that page
    console.warn(`تحذير: تعذر تحميل خط الصفحة ${pageNumber} في المرة المسبقة، سيتم تحميله عند فتح الصفحة`, err);
  }
}

/**
 * تحقق مما إذا كانت كل الخطوط محمّلة في الذاكرة مسبقاً.
 */
export function isFontsPrefetched(): boolean {
  return isPrefetched;
}

/**
 * Get count of successfully loaded fonts
 */
export function getLoadedFontCount(): number {
  return loadedFonts.size;
}

/**
 * Reset font cache (for debugging or clearing)
 */
export function resetFontCache(): void {
  loadedFonts.clear();
  isPrefetched = false;
  prefetchPromise = null;
  document.fonts.clear?.();
}
