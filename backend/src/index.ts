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

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' })
);

app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

export default app;
