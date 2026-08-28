package com.sakeenah.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.sakeenah.app.plugin.AdhanPlayerPlugin;
import com.sakeenah.app.plugin.PrayerAlarmPlugin;
import com.sakeenah.app.plugin.RadioCapturePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdhanPlayerPlugin.class);
        registerPlugin(PrayerAlarmPlugin.class);
        registerPlugin(RadioCapturePlugin.class);
        super.onCreate(savedInstanceState);
        hideSystemBars(); // القاعدة #4: إخفاء كامل عند الإطلاق (Immersive Mode)
        createNotificationChannels();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars(); // إعادة التطبيق عند كل focus
        }
    }

    /**
     * القاعدة #4: Immersive Sticky Mode
     * شريط الحالة (الساعة، البطارية، الواي فاي) وشريط التنقل يختفيان تماماً،
     * ويعودان مؤقتاً عند السحب من حافة الشاشة، ثم يختفيان تلقائياً.
     * القاعدة #5: مع Immersive Mode، لا يجب استخدام Safe Area padding في CSS
     */
    private void hideSystemBars() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+ (API 30+)
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                } else {
                    applyLegacyImmersiveFlags();
                }
            } else {
                // Android 7-10 (API 24-29)
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                    getWindow(), getWindow().getDecorView()
                );
                if (controller != null) {
                    controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
                    controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                }
                applyLegacyImmersiveFlags();
            }
        } catch (Exception e) {
            if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
                Log.e("MainActivity", "Failed to apply immersive system bars", e);
            } else {
                Log.w("MainActivity", "Immersive system bars unavailable: " + e.getClass().getSimpleName());
            }
            applyLegacyImmersiveFlags();
        }
    }

    private void applyLegacyImmersiveFlags() {
        View decorView = getWindow().getDecorView();
        int uiOptions = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        decorView.setSystemUiVisibility(uiOptions);
    }

    /**
     * Create notification channels required for prayer notifications on Android 8.0+ (API 26+).
     *
     * Channel 1: "azan_channel" — Full-screen intent, high importance, azan sound.
     * Channel 2: "beep_channel" — Default importance, beep sound for reminders.
     *
     * Without these channels, Android 13/14/15 will SILENCE all prayer notifications.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return; // Notification channels not needed below API 26
        }

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager == null) {
            return;
        }

        // ─── Channel 1: Azan Channel (Prayer Time — High Importance) ───
        NotificationChannel azanChannel = new NotificationChannel(
                "azan_channel",
                "أذان الصلوات والمواقيت",
                NotificationManager.IMPORTANCE_HIGH // 5 — Full-screen intent + sound + heads-up
        );
        azanChannel.setDescription("إشعارات مواقيت الصلاة مع صوت الأذان");
        azanChannel.enableLights(true);
        azanChannel.enableVibration(true);
        azanChannel.setShowBadge(true);

        // Attach azan.wav sound from res/raw
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        azanChannel.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.azan),
                audioAttributes
        );

        notificationManager.createNotificationChannel(azanChannel);

        // ─── Channel 2: Beep Channel (Pre-Prayer Reminders — Default Importance) ───
        NotificationChannel beepChannel = new NotificationChannel(
                "beep_channel",
                "تذكير ما قبل الصلاة والأذكار",
                NotificationManager.IMPORTANCE_DEFAULT // 4 — Sound + heads-up
        );
        beepChannel.setDescription("تذكيرات قبل الصلاة وسورة الملك والبقرة");
        beepChannel.enableLights(true);
        beepChannel.enableVibration(true);
        beepChannel.setShowBadge(true);

        // Attach beep.wav sound from res/raw
        beepChannel.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.beep),
                audioAttributes
        );

        notificationManager.createNotificationChannel(beepChannel);
    }
}
