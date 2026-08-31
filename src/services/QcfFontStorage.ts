import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import { CapacitorZip } from '@capgo/capacitor-zip';
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

      // تحقق من 3 ملفات موزعة على المصحف كله (البداية، الوسط، النهاية)
      // بدلاً من ملف واحد فقط — هذا يضمن أن الـ unzip اكتمل بنجاح لكل المصحف
      const samplePages = [1, 300, 604];
      for (const page of samplePages) {
        const samplePath = `${FONTS_DIR_NAME}/${fontFileName(page)}`;
        try {
          const stat = await Filesystem.stat({
            path: samplePath,
            directory: Directory.Data,
          });
          if (stat.size < 30000) {
            localStorage.removeItem(EXTRACTION_FLAG_KEY);
            return false;
          }
        } catch {
          localStorage.removeItem(EXTRACTION_FLAG_KEY);
          return false;
        }
      }
      return true;
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

      // امسح أي ملف سابق بنفس الاسم قبل بدء التنزيل
      try {
        await Filesystem.deleteFile({ path: zipTempPath, directory: Directory.Data });
      } catch {
        // الملف قد لا يكون موجوداً — تجاهل بصمت
      }

      // الحل الجذري: FileTransfer (native) يتجاوز WebView بالكامل في تنزيل الخطوط.
      // على Android، FileTransfer يستخدم HttpURLConnection الأصلي الذي يتبع redirects
      // بشكل صحيح ويتفادى ضغط الذاكرة من Base64 chunked processing في WebView.
      // مسار الويب لا يستدعي extractFonts إطلاقاً (early return في السطر 197).
      const fileInfo = await Filesystem.getUri({
        path: zipTempPath,
        directory: Directory.Data,
      });

      // استمع لـ progress events
      const progressListener = await FileTransfer.addListener('progress', (progress: any) => {
        const downloaded = progress.bytes || 0;
        const total = progress.contentLength || 0;
        if (total > 0) {
          const fetchPercent = 15 + Math.floor((downloaded / total) * 45); // 15% -> 60%
          onProgress?.(fetchPercent, `تنزيل الخطوط: ${Math.round((downloaded / 1024 / 1024) * 10) / 10} ميجا / ${Math.round((total / 1024 / 1024) * 10) / 10} ميجا...`);
        }
      });

      try {
        await FileTransfer.downloadFile({
          url: REMOTE_ZIP_URL,
          path: fileInfo.uri,
          progress: true,
        });
      } finally {
        progressListener.remove();
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
