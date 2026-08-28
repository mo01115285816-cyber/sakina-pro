/**
 * MediaSessionBridge — الجسر الرسمي لنظام الوسائط في الهاتف (MediaSession API).
 *
 * عند تشغيل قرآن أو راديو، هذا الكلاس يربط التشغيل بنظام الوسائط الرسمي في الهاتف:
 * - على Android: يظهر اشعار وسائط قياسي (MediaStyle) مع أزرار تشغيل/إيقاف/التالي/السابق
 * - على iOS: يظهر في Control Center و lock screen
 * - على المتصفح: يظهر في controls الوسائط القياسية
 *
 * هذا هو البديل الرسمي والاحترافي للجزيرة الديناميكية العائمة (التي أُزيلت).
 * الهاتف نفسه يقرر كيف يعرض اشعار الوسائط حسب تصميمه الأصلي.
 */
export class MediaSession {
  private static currentAudio: HTMLAudioElement | null = null;
  private static positionUpdateInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * ربط عنصر HTML audio بنظام الوسائط في الهاتف.
   * يجب استدعاؤها عند بدء تشغيل قرآن أو راديو.
   */
  static bindAudio(audio: HTMLAudioElement): void {
    this.currentAudio = audio;
    // تحديث position كل ثانية لنظام الوسائط
    this.clearPositionInterval();
    this.positionUpdateInterval = setInterval(() => {
      this.updatePositionState();
    }, 1000);
  }

  /**
   * فك الربط — يجب استدعاؤها عند إيقاف التشغيل أو مغادرة الصفحة.
   */
  static unbindAudio(): void {
    this.currentAudio = null;
    this.clearPositionInterval();
  }

  private static clearPositionInterval(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * تحديث بيانات الوسائط (عنوان، قارئ/محطة، صورة).
   */
  static async setMetadata(metadata: {
    title: string;
    artist: string;
    album?: string;
    artwork?: Array<{ src: string; sizes?: string; type?: string }>;
  }): Promise<void> {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const artwork = metadata.artwork && metadata.artwork.length > 0
        ? metadata.artwork
        : [
            { src: '/images/quran_artwork.jpg', sizes: '512x512', type: 'image/jpeg' },
          ];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album || 'سَكِينَة',
        artwork,
      });
    } catch (e) {
      console.warn('MediaSession setMetadata failed:', e);
    }
  }

  /**
   * تسجيل معالجات أزرار التحكم (تشغيل/إيقاف/التالي/السابق/الإيقاف).
   * تمر null لإزالة المعالج.
   */
  static async setActionHandler(
    options: { action: 'play' | 'pause' | 'stop' | 'nexttrack' | 'previoustrack' | 'seekto' },
    handler: (() => void) | null,
  ): Promise<void> {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if (options.action === 'seekto') {
        // seekto يحتاج معالج خاص يقبل positionMs
        const seekHandler = (handler as unknown as ((details: { seekTime: number }) => void)) || null;
        try {
          navigator.mediaSession.setActionHandler('seekto' as MediaSessionAction, (details: MediaSessionActionDetails) => {
            if (seekHandler && 'seekTime' in details) {
              seekHandler({ seekTime: (details as { seekTime?: number }).seekTime ?? 0 });
            }
          });
        } catch {
          // seekto قد لا يكون مدعوماً على كل الأجهزة — تجاهل بصمت
        }
      } else {
        navigator.mediaSession.setActionHandler(options.action as MediaSessionAction, handler as ((details: MediaSessionActionDetails) => void) | null);
      }
    } catch (e) {
      console.warn(`MediaSession setActionHandler failed for ${options.action}:`, e);
    }
  }

  /**
   * تحديث حالة التشغيل (playing / paused / none).
   */
  static async setPlaybackState(options: { playbackState: 'playing' | 'paused' | 'none' }): Promise<void> {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = options.playbackState as MediaSessionPlaybackState;
    } catch (e) {
      console.warn('MediaSession setPlaybackState failed:', e);
    }
  }

  /**
   * تحديث موضع التشغيل (لشريط التقدم في اشعار الوسائط الرسمي).
   */
  static async updatePositionState(): Promise<void> {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !this.currentAudio) return;
    try {
      if (typeof navigator.mediaSession.setPositionState === 'function' && !isNaN(this.currentAudio.duration)) {
        navigator.mediaSession.setPositionState({
          duration: this.currentAudio.duration || 0,
          position: this.currentAudio.currentTime || 0,
          playbackRate: this.currentAudio.playbackRate || 1,
        });
      }
    } catch {
      // setPositionState قد يفشل إذا لم تكن metadata مضبوطة — تجاهل بصمت
    }
  }
}
