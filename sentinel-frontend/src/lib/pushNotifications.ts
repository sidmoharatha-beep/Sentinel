// Push notification registration — uses @capacitor/push-notifications which
// wraps Firebase Cloud Messaging on Android (free, native, works even when
// the app is closed/killed). No-ops gracefully when running in a regular
// browser (no Capacitor native bridge present) so this is safe to call from
// the same codebase that also runs as the live website for ITC.

import { registerFcmToken } from './api';

let initialized = false;

export async function setupPushNotifications() {
  if (initialized) return;
  initialized = true;

  // Only run inside the native Android app (Capacitor), not the browser.
  const isNative = (window as any).Capacitor?.isNativePlatform?.();
  if (!isNative) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      // Send this device's token to our backend so we can push to it later
      registerFcmToken(token.value).catch(() => {});
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error', err);
    });

    // Foreground notification — show as in-app toast/alert since Android
    // won't show a system banner while the app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received in foreground:', notification);
    });

    // User tapped a notification (app was backgrounded/closed)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.type === 'sos' || data?.type === 'incident') {
        window.location.href = '/live-site';
      }
    });
  } catch (e) {
    console.warn('Push notification setup skipped:', e);
  }
}
