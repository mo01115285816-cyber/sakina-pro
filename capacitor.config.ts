import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sakeenah.app',
  appName: 'سَكِينَة',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    // القاعدة #7: تفعيل allowMixedContent ضروري لبث إذاعة القاهرة (radiojar.com).
    allowMixedContent: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sakeenah',
      iconColor: '#b88a4f',
      sound: 'azan.wav',
    },
  },
};

export default config;
