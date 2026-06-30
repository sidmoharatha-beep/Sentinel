import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './types';

import auth from './routes/auth';
import sites from './routes/sites';
import patrols from './routes/patrols';
import incidents from './routes/incidents';
import compliance from './routes/compliance';
import notifications from './routes/notifications';
import dashboard from './routes/dashboard';

const app = new Hono<{ Bindings: Env }>();

app.use(logger());
app.use(
  cors({
    origin: (origin) => {
      const allowed = ['http://localhost:5173','https://sentinel-frontend-2m3.pages.dev','https://31f8aa40.sentinel-frontend-2m3.pages.dev'];
      if (!origin || allowed.includes(origin)) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use('/api/*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  await next();
});

app.route('/api/auth', auth);
app.route('/api/sites', sites);
app.route('/api/patrols', patrols);
app.route('/api/incidents', incidents);
app.route('/api/compliance', compliance);
app.route('/api/notifications', notifications);
app.route('/api/dashboard', dashboard);

// ─── Groq Whisper + Llama 3.1: Odia voice → AI-analyzed incident ───────────
app.post('/api/voice-to-incident', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (!c.env.GROQ_API_KEY) return c.json({ error: 'Groq API not configured' }, 503);

  const body = await c.req.json();
  const { audio_base64, mime_type = 'audio/webm' } = body;
  if (!audio_base64) return c.json({ error: 'audio_base64 required' }, 400);

  const audioBytes = Uint8Array.from(atob(audio_base64), ch => ch.charCodeAt(0));
  const formData = new FormData();
  formData.append('file', new Blob([audioBytes], { type: mime_type }), 'audio.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'or');
  formData.append('response_format', 'json');

  const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.GROQ_API_KEY}` },
    body: formData,
  });
  const whisperData: any = await whisperRes.json();
  if (!whisperRes.ok) return c.json({ error: whisperData.error?.message || 'Whisper failed' }, 500);
  const odiaText = whisperData.text || '';
  if (!odiaText.trim()) return c.json({ transcript_odia: '', transcript_english: '', analysis: null });

  const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are a security incident analysis system for an industrial plant (ITC ICML, Khordha, Odisha).
You receive Odia language security reports from guards and must output ONLY valid JSON.
Categories: Security | Safety | Fire | Environmental | Housekeeping
Severities: Critical | High | Medium | Low
Respond ONLY with this JSON structure, no other text:
{"english":"English translation","category":"...","severity":"...","title":"short title max 10 words","action_required":"immediate action needed"}`,
        },
        { role: 'user', content: `Odia guard report: "${odiaText}"` },
      ],
    }),
  });
  const llmData: any = await llmRes.json();
  let analysis = null;
  if (llmRes.ok) {
    try {
      const raw = llmData.choices?.[0]?.message?.content || '{}';
      analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch { analysis = null; }
  }

  return c.json({ transcript_odia: odiaText, transcript_english: analysis?.english || odiaText, analysis });
});

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' })
);

// Serve static frontend files
app.get('/*', async (c) => {
  const assets = c.env.ASSETS;
  if (!assets) {
    return c.text('Static assets not configured', 500);
  }

  try {
    // Try to serve the requested file
    const assetResponse = await assets.fetch(c.req.raw);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  } catch {
    // Asset not found, fall through to index.html
  }

  // For SPA routing: serve index.html for all non-API, non-asset routes
  try {
    const indexResponse = await assets.fetch(
      new Request(new URL('/index.html', c.req.url))
    );
    return indexResponse;
  } catch {
    return c.text('Not Found', 404);
  }
});

app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
