import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './types';
import { getAuthUser } from './auth';

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

// ─── Cloudflare Workers AI: Hindi voice → AI-analyzed incident ─────────────
// Whisper (large-v3-turbo) transcribes Hindi speech; Llama 3.1 8B translates,
// categorizes, assigns severity, and drafts an action. Both run on
// Cloudflare's own AI platform via the native `env.AI` binding — no external
// API key, same infra as the rest of the Worker.
app.post('/api/voice-to-incident', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { audio_base64 } = body;
  if (!audio_base64) return c.json({ error: 'audio_base64 required' }, 400);

  let hindiText = '';
  try {
    const whisperResult: any = await c.env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: audio_base64,
      language: 'hi',
    });
    hindiText = whisperResult?.text || '';
  } catch (e: any) {
    return c.json({ error: `Speech transcription failed: ${e.message || e}` }, 500);
  }

  if (!hindiText.trim()) {
    return c.json({ transcript_hindi: '', transcript_english: '', analysis: null });
  }

  let analysis: any = null;
  try {
    const llmResult: any = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are a security incident analysis system for an industrial plant (ITC ICML, Khordha, Odisha).
You receive Hindi language security reports from guards and must output ONLY valid JSON.
Categories: Security | Safety | Fire | Environmental | Housekeeping
Severities: Critical | High | Medium | Low
Respond ONLY with this JSON structure, no other text:
{"english":"English translation","category":"...","severity":"...","title":"short title max 10 words","action_required":"immediate action needed"}`,
        },
        { role: 'user', content: `Hindi guard report: "${hindiText}"` },
      ],
    });
    const raw = llmResult?.response || '{}';
    analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e: any) {
    console.error('voice-to-incident: Llama analysis failed', e);
    analysis = null;
  }

  return c.json({
    transcript_hindi: hindiText,
    transcript_english: analysis?.english || hindiText,
    analysis,
  });
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
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
