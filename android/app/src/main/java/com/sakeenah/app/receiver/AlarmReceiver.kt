package com.sakeenah.app.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sakeenah.app.MainActivity
import com.sakeenah.app.R
import com.sakeenah.app.service.CountdownForegroundService
import com.sakeenah.app.service.AdhanPlayerService
import com.sakeenah.app.util.PrayerPreferencesReader

/**
 * AlarmReceiver — fires Exact Alarms scheduled by AlarmScheduler.
 *
 * This receiver is triggered at the exact millisecond when:
 * 1. Pre-prayer reminder (10 minutes before adhan) → starts CountdownForegroundService
 * 2. Prayer time itself → shows the main adhan notification
 *
 * The receiver is lightweight: it immediately delegates to a Service
 * and returns, avoiding ANR (Application Not Responding) errors.
 *
 * Action types:
 * - ACTION_PRAYER_ALARM: triggers the main adhan notification
 * - ACTION_PRE_PRAYER_ALARM: starts the 10-minute countdown service
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmReceiver"

        const val ACTION_PRAYER_ALARM = "com.sakeenah.app.action.PRAYER_ALARM"
        const val ACTION_PRE_PRAYER_ALARM = "com.sakeenah.app.action.PRE_PRAYER_ALARM"

        const val EXTRA_PRAYER_KEY = "prayer_key"
        const val EXTRA_PRAYER_NAME = "prayer_name"
        const val EXTRA_PRAYER_TIME_MS = "prayer_time_ms"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val prayerKey = intent.getStringExtra(EXTRA_PRAYER_KEY) ?: return
        val prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME) ?: return
        val prayerTimeMs = intent.getLongExtra(EXTRA_PRAYER_TIME_MS, 0L)

        Log.d(TAG, "Received alarm: action=$action, prayer=$prayerName (key=$prayerKey)")

        when (action) {
            ACTION_PRE_PRAYER_ALARM -> {
                // Start the 10-minute live countdown foreground service
                CountdownForegroundService.start(context, prayerKey, prayerName, prayerTimeMs)
            }

            ACTION_PRAYER_ALARM -> {
                // Cancel the countdown service (10 minutes are up)
                CountdownForegroundService.stop(context, prayerKey)

                // ═══════════════════════════════════════════════════════════════
                // READ PRAYER PREFERENCES BEFORE PLAYING ADHAN
                // ═══════════════════════════════════════════════════════════════
                
                val enabled = PrayerPreferencesReader.isPrayerEnabled(context, prayerKey)
                if (!enabled) {
                    Log.d(TAG, "Prayer $prayerName is disabled — skipping prayer-time notification")
                    return
                }

                val mode = PrayerPreferencesReader.getPrayerMode(context, prayerKey)
                val randomReflection = getReflectionsForPrayer(prayerKey).randomOrNull() ?: ""

                if (mode == "azan_short" || mode == "azan_full") {
                    // AdhanPlayerService resolves the selected local file by prayer key.
                    // Do not use Dynamic Island artwork metadata as an audio URI.
                    AdhanPlayerService.start(
                        context,
                        prayerKey,
                        prayerName,
                        randomReflection,
                        null,
                        mode == "azan_full"
                    )
                    Log.d(TAG, "Started adhan player for $prayerName")
                } else {
                    showPrayerNotification(context, prayerKey, prayerName, randomReflection, mode)
                    Log.d(TAG, "Shown prayer-time notification for $prayerName mode=$mode")
                }
            }
        }
    }

    private fun showPrayerNotification(
        context: Context,
        prayerKey: String,
        prayerName: String,
        body: String,
        mode: String,
    ) {
        val channelId = ensurePrayerChannel(context, mode)
        val notificationId = 450000 + prayerKey.hashCode().toLong().toInt().and(0xFFFF)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle("آن أوان صلاة $prayerName")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setOngoing(false)
            .setWhen(System.currentTimeMillis())
            .build()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    private fun ensurePrayerChannel(context: Context, mode: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return "beep_channel"
        val channelId = when (mode) {
            "silent" -> "prayer_silent_channel"
            "vibrate_only" -> "prayer_vibrate_channel"
            else -> "beep_channel"
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(channelId) == null) {
            val importance = if (mode == "silent") NotificationManager.IMPORTANCE_LOW else NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(channelId, "إشعارات مواقيت الصلاة", importance).apply {
                description = "إشعار واحد عند دخول وقت الصلاة"
                enableVibration(mode == "vibrate_only")
                if (mode == "silent") setSound(null, null)
                if (mode == "vibrate_only") vibrationPattern = longArrayOf(0, 500, 200, 500)
                setShowBadge(true)
            }
            manager.createNotificationChannel(channel)
        }
        return channelId
    }

    /**
     * Create a PendingIntent for a specific prayer alarm.
     * Uses FLAG_MUTABLE because AlarmManager requires it on Android 12+.
     */
    fun createPendingIntent(
        context: Context,
        action: String,
        prayerKey: String,
        prayerName: String,
        prayerTimeMs: Long,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_PRAYER_KEY, prayerKey)
            putExtra(EXTRA_PRAYER_NAME, prayerName)
            putExtra(EXTRA_PRAYER_TIME_MS, prayerTimeMs)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        return PendingIntent.getBroadcast(context, requestCode, intent, flags)
    }

    /**
     * Get random spiritual reflections for each prayer.
     * Mirrors the PRAYER_NOTIFICATION_BODIES from PrayerNotificationsService.ts
     */
    private fun getReflectionsForPrayer(prayerKey: String): List<String> {
        return when (prayerKey) {
            "fajr" -> listOf(
                "وقرآن الفجر إن قرآن الفجر كان مشهوداً.",
                "ركعتا الفجر خير من الدنيا وما فيها.",
                "في ذمة الله وحفظه من صلى الفجر.",
                "قام القانتون؛ صلاتك نور يومك وبداية فلاحك.",
                "تجارة الصادقين والجرعة الأولى لسلامك النفسي اليوم.",
                "نُور يومك وبداية فلاحك، \"وقرآن الفجر إن قرآن الفجر كان مشهوداً\"."
            )
            "dhuhr" -> listOf(
                "اترك مشاغل الدنيا، لتقف خاشعاً بين يدي الرحمن.",
                "ساعة تُفتح فيها أبواب السماء، فأقبل بطاعتك.",
                "الصلاة ميزان العمل، جدد طاقتك الروحية الآن.",
                "انقطع عن الأرض لتتصل بالسماء، أرح قلبك.",
                "طهر قلبك ونفسك وسط يومك المزدحم بالصلاة.",
                "فيها تُترك مشاغل الدنيا، لتقف خاشعًا بين يدي الرحمن."
            )
            "asr" -> listOf(
                "\"حافظوا على الصلوات والصلاة الوسطى.\" امتثل لأمر ربك.",
                "من صلّى البردين (الفجر والعصر) دخل الجنة.",
                "\"من صلى البردين دخل الجنة.\" بوابتك لنعيم دائم.",
                "صلاة العصر ميزان الخواتيم، فاجعل ختام نهارك طاعة.",
                "شمس النهار أوشكت على الغروب، أدرك صلاة الأبرار.",
                "حصن عصرك، فلا تدع أجر الصلاة الوسطى يفوتك."
            )
            "maghrib" -> listOf(
                "انطوت صفحة نهارك، فاختمها بأحب الأعمال لله.",
                "شكرٌ على يومٍ مضى، واستقبالٌ لليلٍ يقبل بالقبول.",
                "سارع للخيرات وأدرك الأجر، صلاة المغرب نداء الطمأنينة.",
                "غربت الشمس ويبقى وجه ربك، قف واشكر نعمه.",
                "خلوة المساء الأولى، أرح بها بدنك المتعب من الدنيا.",
                "اجعل أولى خطوات ليلك بين يدي الرحمن، واختم نهارك بذكره."
            )
            "isha" -> listOf(
                "\"من صلى العشاء في جماعة فكأنما قام نصف الليل.\"",
                "محطة السكينة بعد عناء يومك، اختم يومك بطاعة.",
                "\"لو يعلمون ما في العتمة لأتوهما ولو حبواً.\"",
                "نم طاهراً قرير العين، واجعل العشاء آخر عهدك.",
                "نداء الهدوء والصلة الأخيرة بربك، قف بين يديه.",
                "محطة السكينة بعد عناء يومك، أرح قلبك بلقاء ربك واختم يومك بطاعة."
            )
            else -> emptyList()
        }
    }
}
