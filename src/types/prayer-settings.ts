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
      // Merge with defaults to handle new keys added in future versions
      return { ...DEFAULT_PRAYER_PREFERENCES, ...parsed };
    }
  } catch {
    // Corrupted data, use defaults
  }
  return { ...DEFAULT_PRAYER_PREFERENCES };
}

/** Save prayer preferences to localStorage */
export function savePrayerPreferences(prefs: AllPrayersPreferences): void {
  try {
    localStorage.setItem('sakeenah_prayer_prefs', JSON.stringify(prefs));
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

/** Audio choices whose labels and URLs match the published PrayTimes collection. */
export const MUEZZIN_LIST: MuezzinTrack[] = [
  { id: 'abdul_basit', name: 'عبد الباسط', url: 'https://praytimes.org/audio/sunni/Abdul-Basit.mp3', fileName: 'abdul_basit_azan.mp3' },
  { id: 'abdul_ghaffar', name: 'عبد الغفار', url: 'https://praytimes.org/audio/sunni/Abdul-Ghaffar.mp3', fileName: 'abdul_ghaffar_azan.mp3' },
  { id: 'abdul_hakam', name: 'عبد الحكيم', url: 'https://praytimes.org/audio/sunni/Abdul-Hakam.mp3', fileName: 'abdul_hakam_azan.mp3' },
  { id: 'adhan_alaqsa', name: 'أذان الأقصى', url: 'https://praytimes.org/audio/sunni/Adhan-Alaqsa.mp3', fileName: 'adhan_alaqsa.mp3' },
  { id: 'adhan_egypt', name: 'أذان مصر', url: 'https://praytimes.org/audio/sunni/Adhan-Egypt.mp3', fileName: 'adhan_egypt.mp3' },
  { id: 'adhan_halab', name: 'أذان حلب', url: 'https://praytimes.org/audio/sunni/Adhan-Halab.mp3', fileName: 'adhan_halab.mp3' },
  { id: 'adhan_madinah', name: 'أذان المدينة', url: 'https://praytimes.org/audio/sunni/Adhan-Madinah.mp3', fileName: 'adhan_madinah.mp3' },
  { id: 'adhan_makkah', name: 'أذان مكة', url: 'https://praytimes.org/audio/sunni/Adhan-Makkah.mp3', fileName: 'adhan_makkah.mp3' },
  { id: 'al_hussaini', name: 'الحسيني', url: 'https://praytimes.org/audio/sunni/Al-Hussaini.mp3', fileName: 'al_hussaini_azan.mp3' },
  { id: 'bakir_bash', name: 'باكير باش', url: 'https://praytimes.org/audio/sunni/Bakir-Bash.mp3', fileName: 'bakir_bash_azan.mp3' },
  { id: 'hafez', name: 'حافظ', url: 'https://praytimes.org/audio/sunni/Hafez.mp3', fileName: 'hafez_azan.mp3' },
  { id: 'hafiz_murad', name: 'حافظ مراد', url: 'https://praytimes.org/audio/sunni/Hafiz-Murad.mp3', fileName: 'hafiz_murad_azan.mp3' },
  { id: 'minshawi', name: 'المنشاوي', url: 'https://praytimes.org/audio/sunni/Minshawi.mp3', fileName: 'minshawi_azan.mp3' },
  { id: 'naghshbandi', name: 'نقشبندي', url: 'https://praytimes.org/audio/sunni/Naghshbandi.mp3', fileName: 'naghshbandi_azan.mp3' },
  { id: 'saber', name: 'صابر', url: 'https://praytimes.org/audio/sunni/Saber.mp3', fileName: 'saber_azan.mp3' },
  { id: 'sharif_doman', name: 'شريف دومان', url: 'https://praytimes.org/audio/sunni/Sharif-Doman.mp3', fileName: 'sharif_doman_azan.mp3' },
  { id: 'yusuf_islam', name: 'يوسف إسلام', url: 'https://praytimes.org/audio/sunni/Yusuf-Islam.mp3', fileName: 'yusuf_islam_azan.mp3' },
];
