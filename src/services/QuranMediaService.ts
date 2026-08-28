import { MediaSession } from './MediaSessionBridge';
import { publicAssetUrl } from '@/utils/publicAssetUrl';

/**
 * QuranMediaService — يربط تشغيل القرآن بنظام الوسائط الرسمي للهاتف (MediaSession API).
 *
 * عند تشغيل السورة:
 * - يضبط metadata (اسم السورة، القارئ، صورة الغلاف) في نظام الوسائط
 * - يسجّل معالجات أزرار (تشغيل/إيقاف/التالي/السابق) لاشعار الوسائط الرسمي
 * - يربط عنصر HTML audio بنظام الوسائط لتحديث الموضع تلقائياً
 *
 * اشعار الوسائط الرسمي يظهر تلقائياً في:
 * - شاشة القفل (lock screen)
 * - شريط الإشعارات (Android MediaStyle)
 * - Control Center (iOS)
 * - سماعات Bluetooth
 * - شاشات Android Auto / Wear OS
 */
export class QuranMediaService {
  private static currentReciterName: string = '';
  private static currentSurahName: string = '';
  private static currentIsPlaying: boolean = false;
  private static onPlay?: () => void;
  private static onPause?: () => void;
  private static onNext?: () => void;
  private static onPrev?: () => void;

  static async init(
    audio: HTMLAudioElement,
    reciterName: string,
    surahName: string,
    onPlay?: () => void,
    onPause?: () => void,
    onNext?: () => void,
    onPrev?: () => void
  ) {
    this.currentReciterName = reciterName;
    this.currentSurahName = surahName;
    this.onPlay = onPlay;
    this.onPause = onPause;
    this.onNext = onNext;
    this.onPrev = onPrev;

    const artworkUrl = publicAssetUrl('images/quran_artwork.jpg');

    // ربط عنصر audio بنظام الوسائط (لتحديث الموضع في اشعار الوسائط الرسمي)
    MediaSession.bindAudio(audio);

    // ضبط metadata (عنوان، قارئ، صورة) — يظهر في lock screen + notification
    await MediaSession.setMetadata({
      title: surahName,
      artist: reciterName,
      album: 'سَكِينَة — القرآن الكريم',
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    // تسجيل معالجات أزرار التحكم في اشعار الوسائط الرسمي
    await MediaSession.setActionHandler({ action: 'play' }, () => {
      if (onPlay) onPlay();
      else audio.play().catch((err) => console.warn(err));
      this.currentIsPlaying = true;
      this.updatePlaybackState('playing');
    });

    await MediaSession.setActionHandler({ action: 'pause' }, () => {
      if (onPause) onPause();
      else audio.pause();
      this.currentIsPlaying = false;
      this.updatePlaybackState('paused');
    });

    await MediaSession.setActionHandler({ action: 'stop' }, () => {
      audio.pause();
      audio.currentTime = 0;
      this.currentIsPlaying = false;
      this.updatePlaybackState('none');
    });

    await MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
      if (onNext) onNext();
      else window.dispatchEvent(new CustomEvent('play-next-surah'));
    });

    await MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
      if (onPrev) onPrev();
      else window.dispatchEvent(new CustomEvent('play-prev-surah'));
    });

    await MediaSession.setActionHandler({ action: 'seekto' }, (positionMs: number) => {
      if (audio && !isNaN(audio.duration)) {
        audio.currentTime = positionMs / 1000;
        MediaSession.updatePositionState();
      }
    });
  }

  static async updatePlaybackState(state: 'playing' | 'paused' | 'none') {
    this.currentIsPlaying = state === 'playing';
    await MediaSession.setPlaybackState({ playbackState: state });
    if (state === 'playing') {
      await MediaSession.updatePositionState();
    }
  }

  static destroy() {
    // إيقاف التشغيل وإلغاء التسجيل في نظام الوسائط
    MediaSession.setPlaybackState({ playbackState: 'none' });
    // إزالة معالجات الأزرار لتفريغ اشعار الوسائط
    MediaSession.setActionHandler({ action: 'play' }, null);
    MediaSession.setActionHandler({ action: 'pause' }, null);
    MediaSession.setActionHandler({ action: 'stop' }, null);
    MediaSession.setActionHandler({ action: 'nexttrack' }, null);
    MediaSession.setActionHandler({ action: 'previoustrack' }, null);
    MediaSession.setActionHandler({ action: 'seekto' }, null);
    MediaSession.unbindAudio();
    this.currentIsPlaying = false;
  }
}
