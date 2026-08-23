import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AllPrayersPreferences, PrayerSettingsId, PrayerNotificationMode } from '@/types/prayer-settings';
import { prayerKeyToSettingsId } from '@/types/prayer-settings';
import { PrayerAlarmService } from './PrayerAlarmService';
import type { PrayerSchedule } from './PrayerAlarmService';

type ScheduledPrayer = {
  key: string;
  name: string;
  timeMs: number;
  schedulePrePrayer?: boolean;
};

export class PrayerNotificationsService {
  private static scheduleQueue: Promise<void> = Promise.resolve();
  private static scheduleVersion = 0;

  static isSupported(): boolean {
    return Capacitor.isPluginAvailable('LocalNotifications');
  }

  static async getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      if (this.isSupported()) {
        const current = await LocalNotifications.checkPermissions();
        if (current.display === 'granted') return 'granted';
        if (current.display === 'denied') return 'denied';
        return 'prompt';
      }
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
      }
      return 'prompt';
    } catch (e) {
      console.warn('Failed to check notification permissions:', e);
      return 'denied';
    }
  }

  // طلب الإذن لا يُستدعى إلا من onboarding أو إجراء صريح من المستخدم.
  static async requestPermission(): Promise<boolean> {
    try {
      const current = await this.getPermissionStatus();
      if (current === 'granted') return true;
      if (this.isSupported()) {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      }
      if (typeof Notification !== 'undefined' && current === 'prompt') {
        return (await Notification.requestPermission()) === 'granted';
      }
      return false;
    } catch (e) {
      console.warn('Failed to request notification permissions:', e);
      return false;
    }
  }

  private static deterministicNotificationId(kind: 'pre' | 'prayer' | 'secondary', prayer: ScheduledPrayer): number {
    const input = `${kind}:${prayer.key}:${prayer.timeMs}`;
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return 50000 + (hash >>> 0) % 1800000000;
  }

  /**
   * Serialize and reconcile the complete daily schedule. The latest run wins;
   * all platforms use one logical identity per prayer event.
   */
  static async syncPrayerSchedule({
    prayers,
    prayerPrefs,
    prayerTimeNotificationsEnabled,
    prePrayerRemindersEnabled,
    secondaryReminders,
  }: {
    prayers: ScheduledPrayer[];
    prayerPrefs: AllPrayersPreferences;
    prayerTimeNotificationsEnabled: boolean;
    prePrayerRemindersEnabled: boolean;
    secondaryReminders?: { mulk?: string; baqarah?: string };
  }): Promise<{ ok: boolean; exactAlarmRequired?: boolean }> {
    const version = ++this.scheduleVersion;
    this.scheduleQueue = this.scheduleQueue.then(async () => {
      if (version !== this.scheduleVersion) return;

      await this.clearAllScheduled();
      const futurePrayers = prayers.filter((prayer) => prayer.timeMs > Date.now());
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        const canSchedule = await PrayerAlarmService.canScheduleExactAlarms();
        if (!canSchedule) return;

        const nativePrayers: PrayerSchedule[] = futurePrayers.map((prayer) => {
          const settingsId = prayerKeyToSettingsId(prayer.key);
          const enabled = settingsId ? prayerPrefs[settingsId]?.enabled ?? true : true;
          return {
            ...prayer,
            key: prayer.key as PrayerSchedule['key'],
            schedulePrayerTime: prayerTimeNotificationsEnabled && enabled,
            schedulePrePrayer: prePrayerRemindersEnabled && enabled,
          };
        });

        if (version !== this.scheduleVersion || nativePrayers.length === 0) return;
        await PrayerAlarmService.scheduleAllPrayers(nativePrayers);

        if (this.isSupported()) {
          const secondary = this.buildSecondaryNotifications(secondaryReminders);
          if (secondary.length > 0 && version === this.scheduleVersion) {
            await LocalNotifications.schedule({ notifications: secondary as any });
          }
        }
        return;
      }

      if (!this.isSupported()) return;
      const notifications = futurePrayers.flatMap((prayer) => {
        const reminderTime = new Date(prayer.timeMs - 10 * 60 * 1000);
        const items: Array<Record<string, unknown>> = [];
        if (prePrayerRemindersEnabled && reminderTime.getTime() > Date.now()) {
          items.push({
            id: this.deterministicNotificationId('pre', prayer),
            title: `أوشك الميقات • صلاة ${prayer.name}`,
            body: 'تهيأ بوضوئك، متبقي على الأذان.',
            schedule: { at: reminderTime },
            sound: null,
            channelId: 'beep_channel',
            actionTypeId: 'PRAYER_REMINDER',
          });
        }
        const settingsId = prayerKeyToSettingsId(prayer.key);
        const enabled = settingsId ? prayerPrefs[settingsId]?.enabled ?? true : true;
        if (prayerTimeNotificationsEnabled && enabled) {
          items.push({
            id: this.deterministicNotificationId('prayer', prayer),
            title: `آن أوان صلاة ${prayer.name}`,
            body: 'حان الآن وقت الصلاة. تقبل الله طاعاتكم.',
            schedule: { at: new Date(prayer.timeMs) },
            sound: null,
            channelId: 'beep_channel',
            actionTypeId: 'PRAYER_TIME',
          });
        }
        return items;
      });
      notifications.push(...this.buildSecondaryNotifications(secondaryReminders));
      if (version !== this.scheduleVersion || notifications.length === 0) return;
      await LocalNotifications.schedule({ notifications: notifications as any });
    }).catch((error) => {
      console.warn('Prayer schedule reconciliation failed:', error);
    });

    await this.scheduleQueue;
    const exactAlarmRequired = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
      ? !(await PrayerAlarmService.canScheduleExactAlarms())
      : false;
    return { ok: !exactAlarmRequired, exactAlarmRequired };
  }

  private static buildSecondaryNotifications(secondary?: { mulk?: string; baqarah?: string }): Array<Record<string, unknown>> {
    const notifications: Array<Record<string, unknown>> = [];
    if (secondary?.mulk) {
      const targetDate = this.calculateNextOccurrence(secondary.mulk);
      notifications.push({
        id: 888881,
        title: 'تذكير سورة الملك',
        body: 'حان الآن وقت قراءة سورة الملك المنجية من عذاب القبر.',
        schedule: { at: targetDate },
        sound: 'beep.wav',
        channelId: 'beep_channel',
        actionTypeId: 'MULK_REMINDER',
      });
    }
    if (secondary?.baqarah) {
      const targetDate = this.calculateNextOccurrence(secondary.baqarah);
      notifications.push({
        id: 888882,
        title: 'تذكير سورة البقرة',
        body: 'حان الآن وقت قراءة سورة البقرة المباركة.',
        schedule: { at: targetDate },
        sound: 'beep.wav',
        channelId: 'beep_channel',
        actionTypeId: 'BAQARAH_REMINDER',
      });
    }
    return notifications;
  }

  // 2. إلغاء جميع الإشعارات المجدولة لتفادي التكرار
  static async clearAllScheduled() {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        await PrayerAlarmService.cancelAll();
      }
      if (!this.isSupported()) return;
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (e) {
      console.warn("Error clearing scheduled notifications:", e);
    }
  }

  /**
   * Resolve notification config based on per-prayer preference mode.
   * Returns the appropriate channelId, sound, and extra settings.
   */
  private static resolveNotificationConfig(
    mode: PrayerNotificationMode,
    enabled: boolean
  ): { channelId: string; sound: string | null; extra?: Record<string, unknown> } {
    // If disabled or silent: no sound, no channel
    if (!enabled || mode === 'silent') {
      return { channelId: 'beep_channel', sound: null };
    }

    switch (mode) {
      case 'beep':
        return { channelId: 'beep_channel', sound: 'beep.wav' };
      case 'azan_short':
        // Short azan - uses default azan.wav from res/raw/
        return { channelId: 'azan_channel', sound: 'azan.wav' };
      case 'azan_full':
        // Full azan - uses default azan_full.wav from res/raw/ (if exists)
        // Falls back to azan.wav if azan_full.wav is not available
        return { channelId: 'azan_channel', sound: 'azan_full.wav' };
      case 'vibrate_only':
        return {
          channelId: 'beep_channel',
          sound: null,
          extra: { vibrationPattern: [0, 500, 200, 500] },
        };
      default:
        return { channelId: 'beep_channel', sound: 'beep.wav' };
    }
  }

  /**
   * Prayer notification body texts — 6 spiritual reflections per prayer
   * Random selection ensures variety in each notification
   */
  private static readonly PRAYER_NOTIFICATION_BODIES: Record<string, string[]> = {
    fajr: [
      'وقرآن الفجر إن قرآن الفجر كان مشهوداً.',
      'ركعتا الفجر خير من الدنيا وما فيها.',
      'في ذمة الله وحفظه من صلى الفجر.',
      'قام القانتون؛ صلاتك نور يومك وبداية فلاحك.',
      'تجارة الصادقين والجرعة الأولى لسلامك النفسي اليوم.',
      'نُور يومك وبداية فلاحك، "وقرآن الفجر إن قرآن الفجر كان مشهوداً".',
    ],
    dhuhr: [
      'اترك مشاغل الدنيا، لتقف خاشعاً بين يدي الرحمن.',
      'ساعة تُفتح فيها أبواب السماء، فأقبل بطاعتك.',
      'الصلاة ميزان العمل، جدد طاقتك الروحية الآن.',
      'انقطع عن الأرض لتتصل بالسماء، أرح قلبك.',
      'طهر قلبك ونفسك وسط يومك المزدحم بالصلاة.',
      'فيها تُترك مشاغل الدنيا، لتقف خاشعًا بين يدي الرحمن.',
    ],
    asr: [
      '"حافظوا على الصلوات والصلاة الوسطى." امتثل لأمر ربك.',
      'من صلّى البردين (الفجر والعصر) دخل الجنة.',
      '"من صلى البردين دخل الجنة." بوابتك لنعيم دائم.',
      'صلاة العصر ميزان الخواتيم، فاجعل ختام نهارك طاعة.',
      'شمس النهار أوشكت على الغروب، أدرك صلاة الأبرار.',
      'حصن عصرك، فلا تدع أجر الصلاة الوسطى يفوتك.',
    ],
    maghrib: [
      'انطوت صفحة نهارك، فاختمها بأحب الأعمال لله.',
      'شكرٌ على يومٍ مضى، واستقبالٌ لليلٍ يقبل بالقبول.',
      'سارع للخيرات وأدرك الأجر، صلاة المغرب نداء الطمأنينة.',
      'غربت الشمس ويبقى وجه ربك، قف واشكر نعمه.',
      'خلوة المساء الأولى، أرح بها بدنك المتعب من الدنيا.',
      'اجعل أولى خطوات ليلك بين يدي الرحمن، واختم نهارك بذكره.',
    ],
    isha: [
      '"من صلى العشاء في جماعة فكأنما قام نصف الليل."',
      'محطة السكينة بعد عناء يومك، اختم يومك بطاعة.',
      '"لو يعلمون ما في العتمة لأتوهما ولو حبواً."',
      'نم طاهراً قرير العين، واجعل العشاء آخر عهدك.',
      'نداء الهدوء والصلة الأخيرة بربك، قف بين يديه.',
      'محطة السكينة بعد عناء يومك، أرح قلبك بلقاء ربك واختم يومك بطاعة.',
    ],
  };

  /**
   * Randomly select a spiritual reflection text for the given prayer
   * 100% random selection — no fixed order, no sequential pattern
   */
  private static getRandomPrayerText(prayerKey: string): string {
    const texts = this.PRAYER_NOTIFICATION_BODIES[prayerKey];
    if (!texts || texts.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * texts.length);
    return texts[randomIndex];
  }

  // إشعار تجريبي فوري لتسهيل التحقق والتحكم
  static async scheduleTestNotification(): Promise<boolean> {
    if (!this.isSupported()) {
      // Browser Web Fallback
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("سَكِينَة - إشعار تجريبي", {
            body: "تم تفعيل الإشعارات بنجاح في تطبيق سَكِينَة. تقبل الله طاعاتكم.",
          });
          return true;
        } else if (Notification.permission !== "denied") {
          const result = await Notification.requestPermission();
          if (result === "granted") {
            new Notification("سَكِينَة - إشعار تجريبي", {
              body: "تم تفعيل الإشعارات بنجاح في تطبيق سَكِينَة. تقبل الله طاعاتكم.",
            });
            return true;
          }
        }
      }
      return false;
    }
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999999,
            title: "سَكِينَة - إشعار تجريبي",
            body: "تم تفعيل الإشعارات بنجاح في تطبيق سَكِينَة. تقبل الله طاعاتكم.",
            schedule: { at: new Date(Date.now() + 1000) },
            sound: "azan.wav",
            channelId: "azan_channel",
            actionTypeId: "TEST_NOTIFICATION",
          }
        ]
      });
      return true;
    } catch (e) {
      console.warn("Failed to schedule test notification:", e);
      return false;
    }
  }

  // Helper to calculate the next occurrence of a HH:MM string
  private static calculateNextOccurrence(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  // 6. جدولة تذكير سورة الملك
  static async scheduleMulkReminder(targetTimeStr: string) {
    if (!this.isSupported()) return;
    const targetDate = this.calculateNextOccurrence(targetTimeStr);
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 888881,
            title: "تذكير سورة الملك",
            body: "حان الآن وقت قراءة سورة الملك المنجية من عذاب القبر.",
            schedule: { at: targetDate },
            sound: 'beep.wav',
            channelId: 'beep_channel',
            actionTypeId: 'MULK_REMINDER',
          }
        ]
      });
    } catch (e) {
      console.warn("Failed to schedule Surah Al-Mulk reminder:", e);
    }
  }

  // 7. جدولة تذكير سورة البقرة
  static async scheduleBaqarahReminder(targetTimeStr: string) {
    if (!this.isSupported()) return;
    const targetDate = this.calculateNextOccurrence(targetTimeStr);
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 888882,
            title: "تذكير سورة البقرة",
            body: "حان الآن وقت قراءة سورة البقرة المباركة.",
            schedule: { at: targetDate },
            sound: 'beep.wav',
            channelId: 'beep_channel',
            actionTypeId: 'BAQARAH_REMINDER',
          }
        ]
      });
    } catch (e) {
      console.warn("Failed to schedule Surah Al-Baqarah reminder:", e);
    }
  }

  /**
   * 8. جدولة إشعار للأوقات الثانوية (الضحى، منتصف الليل، الثلث الأخير)
   */
  static async scheduleSecondaryPrayerNotification(
    prayerId: PrayerSettingsId,
    prayerName: string,
    prayerTime: Date,
    prefs: AllPrayersPreferences
  ) {
    if (!this.isSupported()) return;

    const pref = prefs[prayerId];
    if (!pref || !pref.enabled) return;
    if (prayerTime.getTime() <= Date.now()) return;

    const config = this.resolveNotificationConfig(pref.mode, pref.enabled);

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.deterministicNotificationId('secondary', {
              key: prayerId,
              name: prayerName,
              timeMs: prayerTime.getTime(),
            }),
            title: `حان الآن وقت ${prayerName}`,
            body: `حان الآن وقت ${prayerName}. تقبل الله طاعاتكم.`,
            schedule: { at: prayerTime },
            sound: config.sound,
            channelId: config.channelId,
            actionTypeId: 'SPIRITUAL_REMINDER',
            ...config.extra,
          }
        ]
      });
    } catch (e) {
      console.warn(`Failed to schedule ${prayerName} notification:`, e);
    }
  }
}
