# Arabia Learners — Drop‑in Fix Pack
(Generated 2025-09-02T20:19:24)

This pack contains **drop‑in files** and **git‑style patches** to resolve:
- Empty AI queue / `/api/sentence-bundle` errors
- “Used all words from the archive” dead‑end (novelty filter too strict)
- Missing dev runtime for Edge API
- Lack of a “reset recents” tool

## What’s inside

```
dropin/
  README_DROPIN.md
  env/.env.add
  api/served-reset.js
  api/_json.js
  api/sentence-bundle.inner.js           (safer fallback to /api/sentence)
  patches/api/_servedTracker.patch       (shorter novelty window + fallback)
  patches/src/components/TranslateGame.patch  (prefetch timeout + fallback)
```

## How to apply

### 1) Add new API files (safe to copy as-is)

Copy these into your project root:

- `api/served-reset.js`
- `api/_json.js`
- `api/sentence-bundle.inner.js`  (This **replaces** your existing inner bundle handler; it adds a safe fallback loop.)

> If you have a custom wrapper `api/sentence-bundle.js` that re-exports from `.inner.js`, you **do not** need to change it./Users/jordan.mcdaniel/Downloads

### 2) (Recommended) Apply the patches

If your repo is a git repo at the project root, run:

```bash
git apply dropin/patches/api/_servedTracker.patch
git apply dropin/patches/src/components/TranslateGame.patch
```

If patching fails (file differences), open the `.patch` files and manually apply the hunks.

### 3) Add environment vars (dev + prod)

Append the contents of `env/.env.add` to your environment:

```
OPENAI_API_KEY=sk-...
# If using Upstash Redis for "recently served" memory:
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
# Optional: point to prod URL during local Vite only dev
# VITE_API_BASE=https://your-vercel-deployment-url.vercel.app
```

### 4) Local dev that serves Edge API routes

Prefer **vercel dev**:

```bash
npm i -D vercel
npx vercel dev
```

Or set `VITE_API_BASE` to your prod URL in `.env.local`.

### 5) Reset “recently served” memory (optional)

After copying `api/served-reset.js`, you can clear a user’s recent keys:

```
GET /api/served-reset
```

### Notes

- The novelty window is reduced to **1 day** and now **falls back** to allow repeats when the pool is empty.
- Frontend `prefetch()` now has a longer timeout, adds a light retry, and falls back to `/api/sentence` when `/api/sentence-bundle` fails.
