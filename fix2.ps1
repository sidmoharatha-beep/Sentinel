$f = 'C:\Users\Foodsit\VerdentProject\Sentinel\backend\src\index.ts'
$content = [System.IO.File]::ReadAllText($f)
$old = "app.use(logger());
app.use(
  cors({
    origin: (origin) => {
      const allowed = (c.env?.CORS_ORIGINS ?? 'http://localhost:5173,https://d46a861a.sentinel-frontend-2m3.pages.dev').split(',');
      if (!origin || allowed.includes(origin)) return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);"
$new = "app.use(logger());
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env?.CORS_ORIGINS ?? 'http://localhost:5173,https://d46a861a.sentinel-frontend-2m3.pages.dev').split(',');
  const origin = c.req.header('Origin') ?? '';
  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Allow-Credentials', 'true');
  }
  if (c.req.method === 'OPTIONS') return c.text('', 204);
  await next();
});"
$content = $content.Replace($old, $new)
[System.IO.File]::WriteAllText($f, $content)
Write-Host "Done"