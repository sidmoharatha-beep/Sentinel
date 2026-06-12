import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuthUser } from '../auth';
import type { Env, User } from '../types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const user = await getAuthUser(c);
  if (user) c.set('user', user);
  await next();
});

app.get('/', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const rows = await c.env.SENTINEL_DB
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY is_read ASC, created_at DESC LIMIT 100')
    .bind(user.id)
    .all<Record<string, any>>();

  const list = rows.results ?? [];
  const unreadCount = list.filter((r) => !r.is_read).length;
  return c.json({ notifications: list, unread_count: unreadCount });
});

app.patch('/:id/read', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Notification not found' });
  return c.json({ success: true });
});

app.patch('/read-all', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const result = await c.env.SENTINEL_DB
    .prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
    .bind(user.id)
    .run<{ changes: number }>();

  return c.json({ updated: result.meta?.changes ?? (result as any).changes });
});

app.delete('/:id', async (c) => {
  const user = c.get('user') as User | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });

  const id = Number(c.req.param('id'));
  const result = await c.env.SENTINEL_DB
    .prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run<{ changes: number }>();

  if ((result.meta?.changes ?? (result as any).changes) === 0) throw new HTTPException(404, { message: 'Notification not found' });
  return c.body(null, 204);
});

export default app;
