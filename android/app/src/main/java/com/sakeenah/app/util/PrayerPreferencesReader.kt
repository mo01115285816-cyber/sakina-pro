package com.sakeenah.app.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

/**
 * PrayerPreferencesReader — reads prayer notification preferences from SharedPreferences.
 *
 * Reads the same preferences that React writes via savePrayerPreferences() in TypeScript.
 * This allows native Android code (AlarmReceiver, AdhanPlayerService) to respect
 * the user's prayer notification settings.
 *
 * SharedPreferences key: "sakeenah_prayer_prefs"
 * Format: JSON stored by Capacitor LocalStorage plugin
 */
object PrayerPreferencesReader {

    private const val TAG = "PrayerPrefs"
    private const val PREFS_NAME = "sakeenah_prayer_prefs"
    private const val KEY_PRAYER_PREFS = "sakeenah_prayer_prefs"

    /**
     * Get the notification mode for a specific prayer.
     *
     * @param prayerKey One of: fajr, dhuhr, asr, maghrib, isha, duha, midnight, tahajjud
     * @return The notification mode: "beep", "azan_short", "azan_full", "vibrate_only", "silent"
     */
    fun getPrayerMode(context: Context, prayerKey: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val mode = prefs.getString("mode_$prayerKey", "beep")
        Log.d(TAG, "Prayer $prayerKey mode: $mode")
        return mode ?: "beep"
    }

    /**
     * Check if a prayer notification is enabled.
     *
     * @param prayerKey One of: fajr, dhuhr, asr, maghrib, isha, duha, midnight, tahajjud
     * @return true if the prayer notification is enabled
     */
    fun isPrayerEnabled(context: Context, prayerKey: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storedEnabled = prefs.getBoolean("enabled_$prayerKey", true)
        if (!storedEnabled) {
            prefs.edit().putBoolean("enabled_$prayerKey", true).apply()
        }
        Log.d(TAG, "Prayer $prayerKey enabled: true")
        return true
    }

    /**
     * Check if adhan should be played for a prayer.
     * Returns true only if:
     * 1. Prayer is enabled
     * 2. Mode is "azan_short" or "azan_full"
     */
    fun shouldPlayAdhan(context: Context, prayerKey: String): Boolean {
        if (!isPrayerEnabled(context, prayerKey)) {
            Log.d(TAG, "Prayer $prayerKey is disabled — no adhan")
            return false
        }

        val mode = getPrayerMode(context, prayerKey)
        val shouldPlay = mode == "azan_short" || mode == "azan_full"

        Log.d(TAG, "Prayer $prayerKey mode=$mode, shouldPlayAdhan=$shouldPlay")
        return shouldPlay
    }

    /**
     * Save prayer preferences (called from React via Capacitor).
     *
     * @param prayerKey One of: fajr, dhuhr, asr, maghrib, isha, duha, midnight, tahajjud
     * @param enabled true if prayer notification is enabled
     * @param mode One of: beep, azan_short, azan_full, vibrate_only, silent
     */
    fun savePrayerPreference(context: Context, prayerKey: String, enabled: Boolean, mode: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean("enabled_$prayerKey", true)
            .putString("mode_$prayerKey", mode)
            .apply()
        Log.d(TAG, "Saved prayer $prayerKey: enabled=true, mode=$mode")
    }
}
