# Sentinel Deployment

## Backend
```bat
cd backend
npm install
npm run typecheck
npx wrangler deploy
```

## Frontend
```bat
cd sentinel-frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name sentinel-frontend
```

## D1 migration
```bat
cd backend
npx wrangler d1 execute sentinel-db --file=./add_resolution_notes.sql
```
