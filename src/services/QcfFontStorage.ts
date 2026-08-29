import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import localforage from 'localforage';

const FONTS_DIR_NAME = 'qcf-fonts';
const EXTRACTION_FLAG_KEY = 'qcf_fonts_extracted_v1';
const REMOTE_ZIP_URL = 'https://github.com/mo01115285816-cyber/sakina/releases/download/v1.0.0-mushaf-fonts/qcf-fonts.zip';
const WEB_QCF_FONT_BASE_URL = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const LOCAL_WEB_QCF_SAMPLE_PAGES = new Set([1, 2]);

type Platform = 'web' | 'native';

function getPlatform(): Platform {
  try {
    return Capacitor.isNativePlatform() ? 'native' : 'web';
  } catch {
    return 'web';
  }
}

// Lazy-load the Zip plugin only on native platforms to avoid Vite web bundle errors
async function getZipPlugin(): Promise<any> {
  const moduleName = '@capgo/capacitor-zip';
  // Use indirect dynamic import to prevent Vite from pre-bundling this
  // native-only plugin into the web bundle.
  const mod = await (Function('m', 'return import(m)')(moduleName));
  return mod.CapacitorZip;
}

// Create a dedicated IndexedDB store for permanent offline font caching on Web (PWA)
const webFontStore = localforage.createInstance({
  name: 'sakina_quran_fonts',
  storeName: 'qcf_fonts_store',
  description: 'Permanent Offline QCF v2 Mushaf Fonts for Web PWA',
});

function fontFileName(pageNumber: number): string {
  return `p${String(pageNumber).padStart(3, '0')}.woff2`;
}

function fontId(pageNumber: number): string {
  return `QCF_P${String(pageNumber).padStart(3, '0')}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Capacitor Filesystem.getUri() returns a file:// URI, while the Android Zip
 * plugin consumes an absolute filesystem path through java.io.File.
 */
function nativePathFromUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'file:') {
      return decodeURIComponent(parsed.pathname);
    }
  } catch {
    // Keep the original value so the native plugin can report its real error.
  }
  return uri;
}

/**
 * Helper: تنزيل حزمة الخطوط مع إعادة المحاولة عند فشل الشبكة.
 * يحاول حتى MAX_DOWNLOAD_RETRIES محاولات مع exponential backoff.
 * يعيد Response ناجح فقط، أو يُلقي استثناء بعد نفاد المحاولات.
 */
const MAX_DOWNLOAD_RETRIES = 4;
async function fetchFontZipWithRetry(): Promise<Response> {
  let lastError: unknown = new Error('تعذر الاتصال بخادم الخطوط');
  for (let attempt = 0; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
    try {
      const response = await fetch(REMOTE_ZIP_URL);
      if (response.ok) return response;
      lastError = new Error(`تعذر الاتصال بخادم الخطوط (HTTP ${response.status})`);
      // لا تُعيد المحاولة على 4xx (أخطاء العميل)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < MAX_DOWNLOAD_RETRIES) {
      const delay = Math.min(8000, 700 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** حجم التجميع قبل الكتابة على القرص — يوازن بين استهلاك الذاكرة وكفاءة الكتابة. */
const CHUNK_THRESHOLD = 2 * 1024 * 1024; // 2 MB

export const QcfFontStorage = {
  getPlatform,

  async isExtracted(): Promise<boolean> {
    if (getPlatform() !== 'native') {
      // On Web PWA: check dynamic storage in IndexedDB per-page on read
      return true;
    }
    try {
      const flag = localStorage.getItem(EXTRACTION_FLAG_KEY);
      if (flag !== 'true') return false;

      // Physical integrity check for page 1 font file in device storage
      const samplePath = `${FONTS_DIR_NAME}/${fontFileName(1)}`;
      try {
        const stat = await Filesystem.stat({
          path: samplePath,
          directory: Directory.Data,
        });
        return stat.size >= 30000;
      } catch {
        localStorage.removeItem(EXTRACTION_FLAG_KEY);
        return false;
      }
    } catch {
      return false;
    }
  },

  async extractFonts(
    onProgress?: (percent: number, status: string) => void
  ): Promise<void> {
    if (getPlatform() !== 'native') {
      onProgress?.(100, 'الخطوط جاهزة للعمل على متصفح الويب');
      return;
    }

    if (await this.isExtracted()) {
      onProgress?.(100, 'خطوط المصحف جاهزة ومخزنة في ذاكرة الهاتف');
      return;
    }

    onProgress?.(5, 'جاري الاتصال بالخادم السحابي لخطوط المصحف الشريف...');

    try {
      await Filesystem.mkdir({
        path: FONTS_DIR_NAME,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // Directory may already exist
    }

    const zipTempPath = 'qcf-fonts.zip';

    try {
      onProgress?.(15, 'جاري تنزيل حزمة خطوط المصحف الشريف (97 ميجابايت)...');

      // تنزيل الحزمة من GitHub Releases CDN مع إعادة المحاولة عند فشل الشبكة
      const response = await fetchFontZipWithRetry();

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      let downloadedBytes = 0;

      // امسح أي ملف سابق بنفس الاسم قبل بدء الكتابة المتدفقة
      try {
        await Filesystem.deleteFile({ path: zipTempPath, directory: Directory.Data });
      } catch {
        // الملف قد لا يكون موجوداً — تجاهل بصمت
      }

      const reader = response.body?.getReader();

      // كتابة متدفقة chunk-by-chunk مع تجميع حتى CHUNK_THRESHOLD (2 MB)
      // قبل كل عملية appendFile — هذا يخفض عدد عمليات الكتابة عبر الـ bridge
      // من آلاف العمليات إلى ~49 عملية فقط، ويحافظ على استهلاك ذاكرة منخفض (~3 MB).
      const pendingChunk = new Uint8Array(CHUNK_THRESHOLD);
      let pendingOffset = 0;

      const flushPending = async () => {
        if (pendingOffset === 0) return;
        const slice = pendingChunk.subarray(0, pendingOffset);
        const chunkBase64 = arrayBufferToBase64(slice.buffer);
        await Filesystem.appendFile({
          path: zipTempPath,
          data: chunkBase64,
          directory: Directory.Data,
        });
        pendingOffset = 0;
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            downloadedBytes += value.length;

            // أضف القطعة إلى buffer المؤقت؛ اكتب إذا امتلأ
            if (pendingOffset + value.length > CHUNK_THRESHOLD) {
              await flushPending();
            }
            // إذا كانت القطعة نفسها أكبر من CHUNK_THRESHOLD (نادر)، اكتبها مباشرة
            if (value.length >= CHUNK_THRESHOLD) {
              const directBase64 = arrayBufferToBase64(value.buffer);
              await Filesystem.appendFile({
                path: zipTempPath,
                data: directBase64,
                directory: Directory.Data,
              });
            } else {
              pendingChunk.set(value, pendingOffset);
              pendingOffset += value.length;
            }

            if (totalBytes > 0) {
              const fetchPercent = 15 + Math.floor((downloadedBytes / totalBytes) * 45); // 15% -> 60%
              onProgress?.(fetchPercent, `تنزيل الخطوط: ${Math.round((downloadedBytes / 1024 / 1024) * 10) / 10} ميجا / ${Math.round((totalBytes / 1024 / 1024) * 10) / 10} ميجا...`);
            }
          }
        }
        // اكتب أي بقايا متبقية في buffer
        await flushPending();
      } else {
        // Fallback: استخدم blob دفعة واحدة (نادراً ما يُستخدم — فقط إذا لم يتوفر reader)
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const fullBase64 = arrayBufferToBase64(buffer);
        await Filesystem.writeFile({
          path: zipTempPath,
          data: fullBase64,
          directory: Directory.Data,
          recursive: true,
        });
      }

      onProgress?.(65, 'جاري حفظ الحزمة المضغوطة في ذاكرة الهاتف الدائمة...');

      onProgress?.(75, 'جاري فك ضغط وتجهيز 604 صفحة للمصحف الشريف...');

      // Unzip in Directory.Data on Android and iOS
      const Zip = await getZipPlugin();
      const zipFileUri = await Filesystem.getUri({
        path: zipTempPath,
        directory: Directory.Data,
      });
      const targetDirUri = await Filesystem.getUri({
        path: FONTS_DIR_NAME,
        directory: Directory.Data,
      });

      await Zip.unzip({
        source: nativePathFromUri(zipFileUri.uri),
        destination: nativePathFromUri(targetDirUri.uri),
      });

      onProgress?.(92, 'التحقق من سلامة جودة الحروف وعلامات التجويد...');

      // Strict verification: ensure extracted files are not corrupted
      const sampleStat = await Filesystem.stat({
        path: `${FONTS_DIR_NAME}/${fontFileName(1)}`,
        directory: Directory.Data,
      });
      if (sampleStat.size < 30000) {
        throw new Error(`ملف الخط المستخرج غير مكتمل أو تالف (${sampleStat.size} بايت)`);
      }

      onProgress?.(97, 'جاري تنظيف الملفات المؤقتة لتوفير مساحة الهاتف...');
      try {
        await Filesystem.deleteFile({
          path: zipTempPath,
          directory: Directory.Data,
        });
      } catch {
        // Ignore non-critical cleanup errors
      }

      localStorage.setItem(EXTRACTION_FLAG_KEY, 'true');
      onProgress?.(100, 'اكتمل تنزيل وتجهيز خطوط المصحف بنجاح');

    } catch (err) {
      // Automatic reverse cleanup on network failure or error
      try {
        await Filesystem.deleteFile({ path: zipTempPath, directory: Directory.Data });
      } catch {}
      try {
        await Filesystem.rmdir({ path: FONTS_DIR_NAME, directory: Directory.Data, recursive: true });
      } catch {}
      localStorage.removeItem(EXTRACTION_FLAG_KEY);
      throw new Error(`فشل تنزيل وتجهيز خطوط المصحف: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  async clearExtractedFonts(): Promise<void> {
    if (getPlatform() === 'native') {
      try {
        await Filesystem.rmdir({ path: FONTS_DIR_NAME, directory: Directory.Data, recursive: true });
      } catch {}
      localStorage.removeItem(EXTRACTION_FLAG_KEY);
    } else {
      await webFontStore.clear();
    }
  },

  async readFontAsBlobUrl(pageNumber: number): Promise<string> {
    const platform = getPlatform();
    const fileName = fontFileName(pageNumber);

    if (platform === 'native') {
      // Fast direct read from device internal permanent storage (Capacitor Data Directory)
      const filePath = `${FONTS_DIR_NAME}/${fileName}`;
      try {
        const result = await Filesystem.readFile({
          path: filePath,
          directory: Directory.Data,
        });
        const byteCharacters = atob(result.data as string);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'font/woff2' });
        return URL.createObjectURL(blob);
      } catch (err) {
        throw new Error(`تعذر قراءة خط الصفحة ${pageNumber} من ذاكرة الهاتف`);
      }
    }

    // On Web PWA: check IndexedDB permanent storage first
    try {
      const cachedBuffer = await webFontStore.getItem<ArrayBuffer>(fileName);
      if (cachedBuffer) {
        const blob = new Blob([cachedBuffer], { type: 'font/woff2' });
        return URL.createObjectURL(blob);
      }

      // If not cached, fetch from server and store in IndexedDB for permanent offline use
      const fetchUrls = [
        ...(LOCAL_WEB_QCF_SAMPLE_PAGES.has(pageNumber) ? [`/fonts/qcf/${fileName}`] : []),
        `${WEB_QCF_FONT_BASE_URL}/p${pageNumber}.woff2`,
      ];

      for (const url of fetchUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength >= 30000) {
              await webFontStore.setItem(fileName, buffer);
              const blob = new Blob([buffer], { type: 'font/woff2' });
              return URL.createObjectURL(blob);
            }
          }
        } catch {}
      }
      throw new Error(`فشل جلب خط الصفحة ${pageNumber} من الخادم السحابي`);
    } catch (err) {
      throw new Error(`خطأ في تهيئة خط الصفحة ${pageNumber}: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  fontId,
  fontFileName,
};
