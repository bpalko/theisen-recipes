# Theisen Recipes

A password-gated family recipe bookshelf. Books sit on a 3D shelf by category; the A–Z index and live search find anything; family members can add recipes and photos.

The 15 recipes in `src/content/recipes/` are **sample starters**. Swap them for real Theisen recipes, or leave them and add the real ones through the **Add recipe** screen (those persist in R2, not git).

![Bookshelf](docs/screenshots/02-bookshelf.png)

## Local development

```bash
pnpm install
cp .env.example .dev.vars   # then edit the password and session secret
```

### UI only (Vite)

```bash
pnpm dev
```

Fast HMR for layout work. There is **no password gate** and **no R2**, so Add recipe cannot save.

### Full app (Cloudflare Pages + Functions + local R2)

```bash
pnpm pages
```

This builds the site and runs `wrangler pages dev`. Open the URL Wrangler prints (usually `http://127.0.0.1:8788`).

- Password gate: value of `BOOKSHELF_PASSWORD` in `.dev.vars`
- Family recipes and photos: local R2 simulation of the `RECIPES` binding (persisted under `.wrangler/`)

```bash
pnpm test
pnpm check    # tests + typecheck + production build
```

## Adding recipes

### Real family recipes (recommended)

1. Sign in to the bookshelf.
2. Click **Add recipe**.
3. Fill in title, book, contributor, times, ingredients, and steps.
4. Attach pictures (JPEG, PNG, WebP, or GIF; up to 6, 8 MB each).
5. Save. The recipe JSON and photos go to the **R2 bucket**; they survive deploys.

### Seed / sample markdown

Drop a `.md` file in `src/content/recipes/`:

```md
---
title: Saturday Banana Bread
category: baking
contributor: Aunt Carol
prepTime: 15 min
cookTime: 55 min
servings: "1 loaf"
tags: [quick-bread, freezer]
notes: The spottier the bananas, the better.
---

## Ingredients

- 3 very ripe bananas, mashed

## Steps

1. Heat the oven to 350°F.
```

`category` must be one of: `baking`, `mains`, `soups`, `sides`, `desserts`, `holidays`.

## Deploy to Cloudflare Pages

1. Create an R2 bucket named `theisen-recipes` in the same account:

   ```bash
   pnpm wrangler r2 bucket create theisen-recipes
   ```

2. Create a Pages project from this repo (build command `pnpm run build`, output `dist`, root `/`). Wrangler config already sets `pages_build_output_dir` and the `RECIPES` R2 binding.

3. In **Settings → Environment variables**, add production secrets:

   - `BOOKSHELF_PASSWORD` — the family password
   - `SESSION_SECRET` — a long random string (HMAC key for the session cookie)

4. Confirm **Settings → Bindings** includes R2 `RECIPES` → `theisen-recipes`. Redeploy after adding the binding if you set it in the dashboard instead of `wrangler.jsonc`.

The password is never stored in git. Sessions are HMAC-signed `HttpOnly` cookies, verified in `functions/_middleware.ts`. Unauthenticated visitors only see the login page; recipe JSON, photos, and the JS bundle stay behind the gate.

## Architecture

| Piece | Where |
| --- | --- |
| Seed recipes | `src/content/recipes/*.md` (bundled at build) |
| Family recipes | R2 `recipes/{slug}.json` |
| Photos | R2 `photos/{id}.{ext}`, served at `/api/photos/:id` |
| Auth | Pages Functions + `BOOKSHELF_PASSWORD` / `SESSION_SECRET` |
| UI | Vite + React, Cloudflare Pages static output |
