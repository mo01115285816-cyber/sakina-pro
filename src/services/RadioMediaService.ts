import { MediaSession } from './MediaSessionBridge';
import { publicAssetUrl } from '@/utils/publicAssetUrl';

/**
 * RadioMediaService — يربط تشغيل الراديو بنظام الوسائط الرسمي للهاتف (MediaSession API).
 *
 * عند تشغيل محطة الراديو:
 * - يضبط metadata (اسم المحطة، وصف، صورة) في نظام الوسائط
 * - يسجّل معالجات أزرار (تشغيل/إيقاف) لاشعار الوسائط الرسمي
 * - يربط عنصر HTML audio بنظام الوسائط لتحديث الموضع تلقائياً
 *
 * اشعار الوسائط الرسمي يظهر تلقائياً في:
 * - شاشة القفل (lock screen)
 * - شريط الإشعارات (Android MediaStyle)
 * - Control Center (iOS)
 * - سماعات Bluetooth
 *
 * ملاحظة: الراديو بث مباشر (live stream)، لذلك لا يوجد "التالي/السابق".
 */
export class RadioMediaService {
  private static currentStationName: string = '';
  private static currentSubtitle: string = '';
  private static currentIsPlaying: boolean = false;
  private static onPlay?: () => void;
  private static onPause?: () => void;

  static async init(
    audio: HTMLAudioElement,
    stationName: string = 'إذاعة القرآن الكريم من القاهرة',
    subtitle: string = 'البث المباشر',
    logoUrl?: string,
    onPlay?: () => void,
    onPause?: () => void
  ) {
    this.currentStationName = stationName;
    this.currentSubtitle = subtitle;
    this.onPlay = onPlay;
    this.onPause = onPause;

    const absoluteLogoUrl = logoUrl
      ? (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') ? logoUrl : publicAssetUrl(logoUrl))
      : publicAssetUrl('images/cairo_radio_artwork.jpg');

    // ربط عنصر audio بنظام الوسائط (لتحديث الموضع في اشعار الوسائط الرسمي)
    MediaSession.bindAudio(audio);

    // ضبط metadata (اسم المحطة، وصف، صورة) — يظهر في lock screen + notification
    await MediaSession.setMetadata({
      title: stationName,
      artist: subtitle,
      album: 'سَكِينَة — بث مباشر',
      artwork: [
        { src: absoluteLogoUrl, sizes: '512x512', type: 'image/jpeg' },
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
      this.currentIsPlaying = false;
      this.updatePlaybackState('none');
    });

    // الراديو لا يدعم التالي/السابق — أزل المعالجات السابقة إن وُجدت
    await MediaSession.setActionHandler({ action: 'nexttrack' }, null);
    await MediaSession.setActionHandler({ action: 'previoustrack' }, null);
    await MediaSession.setActionHandler({ action: 'seekto' }, null);
  }

  static async updatePlaybackState(state: 'playing' | 'paused' | 'none') {
    this.currentIsPlaying = state === 'playing';
    await MediaSession.setPlaybackState({ playbackState: state });
  }

  static destroy() {
    // إيقاف التشغيل وإلغاء التسجيل في نظام الوسائط
    MediaSession.setPlaybackState({ playbackState: 'none' });
    MediaSession.setActionHandler({ action: 'play' }, null);
    MediaSession.setActionHandler({ action: 'pause' }, null);
    MediaSession.setActionHandler({ action: 'stop' }, null);
    MediaSession.unbindAudio();
    this.currentIsPlaying = false;
  }
}
