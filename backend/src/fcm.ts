// Free push notifications via Firebase Cloud Messaging HTTP v1 API.
// No paid service, no external npm package — uses native Web Crypto API
// (available in Cloudflare Workers) to sign a Google OAuth2 service-account
// JWT, exchange it for an access token, then call the FCM send endpoint.

import type { Env } from './types';

interface FcmEnv {
  FCM_PROJECT_ID: string;
  FCM_CLIENT_EMAIL: string;
  FCM_PRIVATE_KEY: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function getAccessToken(env: FcmEnv): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: env.FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;
  const key = await importPrivateKey(env.FCM_PRIVATE_KEY);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json<{ access_token: string; expires_in: number }>();
  if (!res.ok || !data.access_token) {
    throw new Error('Failed to obtain FCM access token: ' + JSON.stringify(data));
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function sendPushNotification(
  env: FcmEnv,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    return { ok: false, error: 'FCM not configured' };
  }
  try {
    const accessToken = await getAccessToken(env);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            data,
            android: {
              priority: 'high',
              notification: { sound: 'default', channel_id: 'sentinel_alerts' },
            },
          },
        }),
      }
    );
    const result = await res.json<any>();
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(result) };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// Sends a push notification to every user with a given role who has a
// registered device token (e.g. all managers + supervisors on an SOS).
export async function notifyRoles(
  db: D1Database,
  fcmEnv: FcmEnv,
  roles: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const placeholders = roles.map(() => '?').join(',');
  const users = await db
    .prepare(`SELECT id, fcm_token FROM users WHERE role IN (${placeholders}) AND fcm_token IS NOT NULL AND is_active = 1`)
    .bind(...roles)
    .all<{ id: number; fcm_token: string }>();

  for (const u of users.results ?? []) {
    // Fire and forget — don't let one failed push block others
    sendPushNotification(fcmEnv, u.fcm_token, title, body, data).catch(() => {});
  }
}
