# Deployment Commands

## Push to GitHub
```bash
git status
git add .
git commit -m "Add live map and incident resolution"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Frontend deploy to Cloudflare Pages
```bash
cd sentinel-frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name sentinel-frontend
```

## Backend deploy to Cloudflare Workers
```bash
cd backend
npm install
npm run typecheck
npx wrangler deploy
```

## D1 schema update
```bash
cd backend
npx wrangler d1 execute sentinel-db --file=./add_resolution_notes.sql
```
