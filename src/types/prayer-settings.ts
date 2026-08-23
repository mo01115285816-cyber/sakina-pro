/**
 * Prayer Settings — Per-Prayer Notification Preferences
 * سكينة — إعدادات إشعارات الصلاة لكل صلاة على حدة
 */

export type PrayerNotificationMode =
  | 'beep'          // نغمة التنبيه (الافتراضي — خالية من الشبهات)
  | 'azan_short'    // صوت الأذان (مختصر/عادي)
  | 'azan_full'     // الأذان الكامل (مؤذن مخصص)
  | 'vibrate_only'  // اهتزاز فقط
  | 'silent';       // صامت

export interface MuezzinTrack {
  id: string;
  name: string;           // e.g., "علي أحمد ملا"
  url: string;            // CDN/audio URL (MP3)
  fileName: string;       // e.g., "ali_mulla_azan.mp3"
  duration?: string;      // e.g., "2:30"
  isDownloaded?: boolean;
}

export type PrayerSettingsId =
  | 'fajr'
  | 'dhuhr'
  | 'asr'
  | 'maghrib'
  | 'isha'
  | 'duha'
  | 'midnight'
  | 'tahajjud';

export interface SinglePrayerPreference {
  prayerId: PrayerSettingsId;
  prayerDisplayName: string;
  enabled: boolean;
  mode: PrayerNotificationMode;
  selectedMuezzinId?: string;
}

export type AllPrayersPreferences = Record<PrayerSettingsId, SinglePrayerPreference>;

/** Default preferences — all prayers beep mode, enabled */
export const DEFAULT_PRAYER_PREFERENCES: AllPrayersPreferences = {
  fajr:      { prayerId: 'fajr',      prayerDisplayName: 'الفجر',   enabled: true, mode: 'beep' },
  dhuhr:     { prayerId: 'dhuhr',     prayerDisplayName: 'الظهر',   enabled: true, mode: 'beep' },
  asr:       { prayerId: 'asr',       prayerDisplayName: 'العصر',   enabled: true, mode: 'beep' },
  maghrib:   { prayerId: 'maghrib',   prayerDisplayName: 'المغرب',  enabled: true, mode: 'beep' },
  isha:      { prayerId: 'isha',      prayerDisplayName: 'العشاء',  enabled: true, mode: 'beep' },
  duha:      { prayerId: 'duha',      prayerDisplayName: 'الضحى',   enabled: false, mode: 'beep' },
  midnight:  { prayerId: 'midnight',  prayerDisplayName: 'منتصف الليل', enabled: false, mode: 'beep' },
  tahajjud:  { prayerId: 'tahajjud',  prayerDisplayName: 'الثلث الأخير', enabled: false, mode: 'beep' },
};

/** Arabic labels for notification modes */
export const NOTIFICATION_MODE_LABELS: Record<PrayerNotificationMode, { title: string; subtitle: string }> = {
  beep:          { title: 'نغمة التنبيه',  subtitle: 'تشغيل نغمة قصيرة للتذكير.' },
  azan_short:    { title: 'صوت الأذان',     subtitle: 'تشغيل صوت الأذان.' },
  azan_full:     { title: 'الأذان الكامل',   subtitle: 'تشغيل صوت الأذان الكامل.' },
  vibrate_only:  { title: 'اهتزاز فقط',     subtitle: 'يهتز الجهاز عند وقت الصلاة دون صوت.' },
  silent:        { title: 'صامت',            subtitle: 'لن يصدر صوت لأي إشعارات.' },
};

/** Load prayer preferences from localStorage */
export function loadPrayerPreferences(): AllPrayersPreferences {
  try {
    const saved = localStorage.getItem('sakeenah_prayer_prefs');
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<AllPrayersPreferences>;
      // Merge with defaults and normalize legacy disabled values to the always-on policy.
      return Object.fromEntries(
        Object.entries({ ...DEFAULT_PRAYER_PREFERENCES, ...parsed }).map(([key, pref]) => [
          key,
          { ...DEFAULT_PRAYER_PREFERENCES[key as PrayerSettingsId], ...pref, enabled: true },
        ]),
      ) as AllPrayersPreferences;
    }
  } catch {
    // Corrupted data, use defaults
  }
  return { ...DEFAULT_PRAYER_PREFERENCES };
}

/** Save prayer preferences to localStorage */
export function savePrayerPreferences(prefs: AllPrayersPreferences): void {
  try {
    const normalized = Object.fromEntries(
      Object.entries(prefs).map(([key, pref]) => [key, { ...pref, enabled: true }]),
    ) as AllPrayersPreferences;
    localStorage.setItem('sakeenah_prayer_prefs', JSON.stringify(normalized));
  } catch (e) {
    console.warn('Failed to save prayer preferences:', e);
  }
}

/** Map from PrayerKey (app.types) to PrayerSettingsId */
export function prayerKeyToSettingsId(key: string): PrayerSettingsId | null {
  const mapping: Record<string, PrayerSettingsId> = {
    fajr: 'fajr',
    dhuhr: 'dhuhr',
    asr: 'asr',
    maghrib: 'maghrib',
    isha: 'isha',
  };
  return mapping[key] ?? null;
}

/** Verified audio choices with source labels and explicit reuse metadata. */
export const MUEZZIN_LIST: MuezzinTrack[] = [
  {
    id: 'aqib_azeez',
    name: 'عاقب عزيز — أذان كامل',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
    fileName: 'aqib_azeez_azan.mp3',
    duration: '1:27',
  },
  {
    id: 'beautiful_adhan',
    name: 'أذان جميل — تسجيل مستقل',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg',
    fileName: 'beautiful_adhan.ogg',
    duration: '2:34',
  },
];
