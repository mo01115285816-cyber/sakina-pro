import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CapacitorZip } from '@capgo/capacitor-zip';
import localforage from 'localforage';

const FONTS_DIR_NAME = 'qcf-fonts';
const EXTRACTION_FLAG_KEY = 'qcf_fonts_extracted_v1';
const REMOTE_ZIP_URL = 'https://github.com/mo01115285816-cyber/sakina/releases/download/v1.0.0-mushaf-fonts/qcf-fonts.zip';
const WEB_QCF_FONT_BASE_URL = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const LOCAL_WEB_QCF_SAMPLE_PAGES = new Set([1, 2]);

// Timeout and retry constants optimized for Android
const WRITE_OPERATION_TIMEOUT = 60000; // 60 seconds per write
const MAX_WRITE_RETRIES = 3;
const CHUNK_THRESHOLD = 1024 * 1024; // 1 MB (reduced from 2 MB to minimize memory pressure)

type Platform = 'web' | 'native';

function getPlatform(): Platform {
  try {
    return Capacitor.isNativePlatform() ? 'native' : 'web';
  } catch {
    return 'web';
  }
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

/**
 * Convert Uint8Array to base64 string with chunked processing to avoid stack overflow
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
      
      try {
        const response = await fetch(REMOTE_ZIP_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) return response;
        lastError = new Error(`تعذر الاتصال بخادم الخطوط (HTTP ${response.status})`);
        // لا تُعيد المحاولة على 4xx (أخطاء العميل)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
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

/**
 * Write chunk with timeout and retry logic to handle stalled writes on Android
 */
async function writeChunkWithTimeout(
  path: string,
  data: string,
  retryCount = 0
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WRITE_OPERATION_TIMEOUT);

  try {
    // Use Promise wrapper to enforce timeout
    await Promise.race([
      Filesystem.appendFile({
        path,
        data,
        directory: Directory.Data,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WRITE_TIMEOUT')), WRITE_OPERATION_TIMEOUT)
      ),
    ]);
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    
    // Retry on timeout with exponential backoff
    if ((err instanceof Error && err.message === 'WRITE_TIMEOUT') || err === 'WRITE_TIMEOUT') {
      if (retryCount < MAX_WRITE_RETRIES) {
        const retryDelay = Math.min(5000, 500 * 2 ** retryCount);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return writeChunkWithTimeout(path, data, retryCount + 1);
      }
      throw new Error(`فشل كتابة الملف بعد ${MAX_WRITE_RETRIES} محاولات - انقطع الاتصال أو مشكلة في الجهاز`);
    }
    throw err;
  }
}

/**
 * Trigger garbage collection hint on Android to free memory between chunks
 */
function triggerGarbageCollection(): void {
  if (getPlatform() === 'native' && typeof (global as any).gc === 'function') {
    (global as any).gc();
  }
}

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

      // Write streaming chunk-by-chunk with timeout protection
      // Each chunk is written directly without prolonged Base64 conversion to avoid memory leaks
      const pendingChunk = new Uint8Array(CHUNK_THRESHOLD);
      let pendingOffset = 0;
      let writeCount = 0;

      const flushPending = async () => {
        if (pendingOffset === 0) return;
        
        // Slice creates a new ArrayBuffer with only the actual data
        const actualData = pendingChunk.slice(0, pendingOffset);
        const chunkBase64 = arrayBufferToBase64(actualData.buffer);
        
        // Write with timeout and retry logic
        await writeChunkWithTimeout(zipTempPath, chunkBase64);
        writeCount++;
        
        // Trigger GC every 20 writes to prevent memory accumulation
        if (writeCount % 20 === 0) {
          triggerGarbageCollection();
        }
        
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
              await writeChunkWithTimeout(zipTempPath, directBase64);
              writeCount++;
              if (writeCount % 20 === 0) {
                triggerGarbageCollection();
              }
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
        await writeChunkWithTimeout(zipTempPath, fullBase64);
      }

      onProgress?.(65, 'جاري حفظ الحزمة المضغوطة في ذاكرة الهاتف الدائمة...');

      onProgress?.(75, 'جاري فك ضغط وتجهيز 604 صفحة للمصحف الشريف...');

      // Unzip in Directory.Data on Android and iOS
      // CapacitorZip is statically imported at the top of the file.
      // It registers a no-op web implementation via @capgo/capacitor-zip,
      // so this is safe on both web and native.
      const Zip = CapacitorZip;
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
