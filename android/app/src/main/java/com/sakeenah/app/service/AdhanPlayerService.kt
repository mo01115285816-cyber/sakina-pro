package com.sakeenah.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sakeenah.app.MainActivity
import com.sakeenah.app.R
import com.sakeenah.app.receiver.NotificationStopReceiver
import com.sakeenah.app.util.MuezzinHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * AdhanPlayerService — plays the actual adhan audio when prayer time arrives.
 *
 * This service:
 * 1. Requests audio focus
 * 2. Plays the adhan audio file (default or custom muezzin)
 * 3. Shows an ongoing notification with STOP button
 * 4. Stops when user taps STOP or when audio finishes
 * 5. Releases audio focus when done
 *
 * The notification includes:
 * - Title: "آن أوان صلاة {name}"
 * - Body: spiritual reflection text
 * - STOP button: cancels notification and stops audio
 */
class AdhanPlayerService : Service() {

    companion object {
        private const val TAG = "AdhanPlayer"
        const val CHANNEL_ID = "adhan_player_channel"
        const val NOTIFICATION_ID_BASE = 400000

        private const val EXTRA_PRAYER_KEY = "prayer_key"
        private const val EXTRA_PRAYER_NAME = "prayer_name"
        private const val EXTRA_NOTIFICATION_BODY = "notification_body"
        private const val EXTRA_MUEZZIN_URI = "muezzin_uri"
        private const val EXTRA_USE_SELECTED_MUEZZIN = "use_selected_muezzin"
        private const val EXTRA_NOTIFICATION_ID = "notification_id"

        fun getNotificationId(prayerKey: String): Int {
            return NOTIFICATION_ID_BASE + prayerKey.hashCode().toLong().toInt().and(0xFFFF)
        }

        fun start(
            context: Context,
            prayerKey: String,
            prayerName: String,
            notificationBody: String,
            muezzinUri: String? = null,
            useSelectedMuezzin: Boolean = true,
        ) {
            val intent = Intent(context, AdhanPlayerService::class.java).apply {
                putExtra(EXTRA_PRAYER_KEY, prayerKey)
                putExtra(EXTRA_PRAYER_NAME, prayerName)
                putExtra(EXTRA_NOTIFICATION_BODY, notificationBody)
                muezzinUri?.let { putExtra(EXTRA_MUEZZIN_URI, it) }
                putExtra(EXTRA_USE_SELECTED_MUEZZIN, useSelectedMuezzin)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context, prayerKey: String) {
            val intent = Intent(context, AdhanPlayerService::class.java)
            context.stopService(intent)
        }
    }

    private var mediaPlayer: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    private var prayerKey: String = ""
    private var prayerName: String = ""
    private var notificationBody: String = ""
    private var muezzinUri: String? = null
    private var useSelectedMuezzin: Boolean = true

    override fun onCreate() {
        super.onCreate()
        ensureChannelExists()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        prayerKey = intent?.getStringExtra(EXTRA_PRAYER_KEY) ?: ""
        prayerName = intent?.getStringExtra(EXTRA_PRAYER_NAME) ?: ""
        notificationBody = intent?.getStringExtra(EXTRA_NOTIFICATION_BODY) ?: ""
        muezzinUri = intent?.getStringExtra(EXTRA_MUEZZIN_URI)
        useSelectedMuezzin = intent?.getBooleanExtra(EXTRA_USE_SELECTED_MUEZZIN, true) ?: true

        if (prayerKey.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Acquire wake lock
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SakinaAdhanWakeLock").apply {
            setReferenceCounted(false)
            acquire(5 * 60 * 1000L) // 5 minutes max
        }

        // Request audio focus
        requestAudioFocus()

        // Build and show notification
        val notificationId = getNotificationId(prayerKey)
        val notification = buildNotification(notificationId)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(notificationId, notification)
        }

        // Start playing audio
        playAdhan()

        return START_NOT_STICKY
    }

    private fun playAdhan() {
        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                )

                // For scheduled prayer alarms, prefer the selected local file for this prayer.
                // The explicit URI remains available for manual/plugin playback only.
                val selectedMuezzinFile = if (useSelectedMuezzin) {
                    MuezzinHelper.getSelectedMuezzinFile(
                        this@AdhanPlayerService,
                        prayerKey,
                    )
                } else {
                    null
                }
                if (selectedMuezzinFile != null) {
                    setDataSource(selectedMuezzinFile.absolutePath)
                } else {
                    val selectedMuezzinUri = muezzinUri?.let(Uri::parse)
                    val uri = selectedMuezzinUri ?: Uri.parse("android.resource://${packageName}/${R.raw.azan}")
                    setDataSource(this@AdhanPlayerService, uri)
                }
                isLooping = false

                setOnCompletionListener {
                    // Audio finished — stop service
                    stopSelf()
                }

                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "MediaPlayer error: what=$what, extra=$extra")
                    stopSelf()
                    true
                }

                prepareAsync()
                setOnPreparedListener {
                    start()
                    Log.d(TAG, "Started playing adhan for $prayerName")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play adhan", e)
            stopSelf()
        }
    }

    private fun buildNotification(notificationId: Int): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopPendingIntent = NotificationStopReceiver.createStopPendingIntent(
            this, notificationId, prayerKey, notificationId + 10000
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("آن أوان صلاة $prayerName")
            .setContentText(notificationBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notificationBody))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))

            // STOP button
            .addAction(0, "STOP", stopPendingIntent)

            .build()
    }

    private fun requestAudioFocus() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setOnAudioFocusChangeListener { /* No-op — we hold focus until done */ }
                .build()

            audioManager.requestAudioFocus(audioFocusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                { /* No-op */ },
                AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
            )
        }
    }

    private fun releaseAudioFocus() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus { /* No-op */ }
        }
    }

    private fun ensureChannelExists() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "تشغيل الأذان",
            NotificationManager.IMPORTANCE_MAX
        ).apply {
            description = "قناة تشغيل صوت الأذان عند موعد الصلاة"
            enableVibration(true)
            enableLights(true)
            setShowBadge(false)
            setSound(null, null)
            setBypassDnd(true)
        }

        notificationManager.createNotificationChannel(channel)
    }

    override fun onDestroy() {
        super.onDestroy()

        // Stop media player
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping media player", e)
        }

        // Release audio focus
        releaseAudioFocus()

        // Release wake lock
        wakeLock?.release()
        wakeLock = null

        // Cancel notification
        try {
            val notificationId = getNotificationId(prayerKey)
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(notificationId)
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling notification", e)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
