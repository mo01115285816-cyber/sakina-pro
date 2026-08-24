export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export type TabType = "main" | "azkar" | "quran" | "hadith" | "sakeenah-ai" | "settings";

export type AzkarCounterType = "morning" | "evening" | "sleep" | "post_prayer" | "hisn";

export type WeatherData = {
  temp: number;
  conditionCode: number;
  isDay: boolean;
};
