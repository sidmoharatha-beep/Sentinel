# Deploy Commands

## GitHub
```bash
git status
git add .
git commit -m "Add live map and incident resolution"
git branch -M main
git push -u origin main
```

## Cloudflare Backend
```bash
cd backend
npm install
npm run typecheck
npx wrangler deploy
```

## Cloudflare D1 Schema
```bash
cd backend
npx wrangler d1 execute sentinel-db --file=./add_resolution_notes.sql
```

## Cloudflare Frontend
```bash
cd sentinel-frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name sentinel-frontend
```
