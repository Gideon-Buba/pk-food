import { api, getToken } from '../api/client';

const SW_PATH = '/sw.js';

// Returns ArrayBuffer (a valid BufferSource) to avoid the Uint8Array<ArrayBufferLike>
// vs ArrayBufferView<ArrayBuffer> variance issue in TypeScript 5.7+ lib.dom types.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

/** Register /sw.js. Safe to call on every page load — browser deduplicates. */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.warn('[push] Service worker registration failed:', err);
  }
}

/**
 * Request notification permission, subscribe via PushManager, and POST the
 * subscription to the backend. Idempotent — safe to call on every login and
 * on every app load (the backend upserts by endpoint).
 *
 * Fails gracefully on:
 *   - Browsers without PushManager (older Safari, Firefox ESR without flag)
 *   - iOS Safari when the app is not installed to the home screen
 *   - User denying the permission prompt
 */
export async function registerPushNotifications(): Promise<void> {
  console.log('[push] registerPushNotifications called');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] Web Push not supported in this browser');
    return;
  }

  if (!getToken()) {
    console.log('[push] No token — skipping (not logged in)');
    return;
  }

  try {
    console.log('[push] Waiting for SW to be ready…');
    const registration = await navigator.serviceWorker.ready;
    console.log('[push] SW ready, requesting permission…');

    const permissionResult = await Notification.requestPermission();
    console.log('[push] Permission result:', permissionResult);
    if (permissionResult !== 'granted') {
      console.warn('[push] Notification permission not granted:', permissionResult);
      return;
    }

    console.log('[push] Fetching VAPID public key…');
    const { data: keyResponse } = await api.get<{ data: { publicKey: string } }>('/push/public-key');
    const publicKey = keyResponse.data.publicKey;
    console.log('[push] Got VAPID key, subscribing…');

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
    console.log('[push] Subscribed, posting to backend…');

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys) {
      console.warn('[push] Push subscription is missing endpoint or keys');
      return;
    }
    const p256dh = json.keys['p256dh'];
    const auth = json.keys['auth'];
    if (!p256dh || !auth) {
      console.warn('[push] Push subscription is missing p256dh or auth key');
      return;
    }

    await api.post('/push/subscribe', { endpoint: json.endpoint, p256dh, auth });
    console.log('[push] Subscription saved to backend successfully');
  } catch (err) {
    // Log and swallow — a push failure must never block the app.
    console.warn('[push] Failed to subscribe to push notifications:', err);
  }
}

/** Remove the current device's push subscription from both browser and server. */
export async function unregisterPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('[push] Failed to unsubscribe:', err);
  }
}
