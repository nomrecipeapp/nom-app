# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nom — a mobile-web personal cookbook / recipe social app ("Letterboxd for recipes"). Users log recipes they've cooked, rate them, mark a verdict (Make Again / It Was Fine / Never Again), follow friends, and see a feed of what friends are cooking. Built as a PWA meant to be added to the iOS home screen, not a native app.

## Stack

- React 19 + Vite 7, plain JS (no TypeScript in the frontend), no router library — screens are switched by a `screen` string in top-level state (see Architecture below).
- Supabase (Postgres + Auth + Storage + Edge Functions) as the backend — no custom server. All data access goes through `src/supabase.js`'s client directly from components.
- Serverless functions in `api/` (Vercel convention — `export default async function handler(req, res)`), used only for things the browser can't do directly: calling the Anthropic API with a secret key, or fetching third-party pages server-side to dodge CORS.
- Styling is inline `style={}` objects using CSS custom properties defined in `src/index.css` (colors like `var(--clay)`, `var(--cream)`; no CSS-in-JS library, no Tailwind).

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # production build
npm run preview   # preview a production build
npm run lint      # eslint over the whole repo
```

There is no test suite configured in this repo.

The `api/*.js` serverless functions are only invoked when deployed to Vercel (or run via `vercel dev`) — they will 404 under plain `vite dev` since Vite doesn't serve them. If you need to exercise recipe-import/scan flows locally, that's the gap.

## Environment variables

Defined in `.env.local` (gitignored):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side Supabase config, read in `src/supabase.js`.
- `VITE_SPOONACULAR_KEY` — present but check current usage before assuming it's live.
- `ANTHROPIC_API_KEY` — server-side only, used by the `api/*.js` functions (never exposed to the client).
- Supabase Edge Functions (`supabase/functions/*`) use `RESEND_API_KEY` for transactional email via Resend.

## Architecture

### Screen navigation (no router)
`src/App.jsx` is the entire navigation system: a `screen` string in `useState` picks which top-level component renders (`'feed' | 'cookbook' | 'search' | 'profile' | 'recipe' | 'socialRecipe' | 'friendRecipeDetail' | 'friendProfile' | 'followList' | 'notifications' | 'add' | 'resetPassword'`). Navigating pushes the current screen onto `prevScreen` so "Back" can pop to it — there's no history stack beyond one level, and no URL sync except for one-off deep-link params (`?code=`, `?recipe=`, `?cook=`) read once on mount and resolved via `pendingRecipeId`/`pendingCookId` effects. When adding a new screen, follow this same pattern rather than introducing a router.

Auth/onboarding gating happens at the top of `App.jsx`'s render: `loading` → `!session` → `!onboardingComplete` gate which component tree renders. `onboarding_complete` lives in the `profiles` table, not on the Supabase auth user.

### Data model (inferred from Supabase table usage — no migrations checked into this repo)
Tables queried from the client: `profiles`, `recipes`, `cooks`, `follows`, `notifications`, `comments`, `likes`, `invites`, `recipe_views`. Storage buckets: `avatars`, `recipe-images`, `cook-photos`.

Key relationship: a `recipe` is the cookbook entry (title, ingredients, instructions); a `cook` is a logged instance of making it (photo, verdict, ratings, timestamp) and is what shows up in the social feed. `follows` has a `status` column (`'approved'` vs pending) — the app is follow-request-gated, not open-follow, so most friend-content queries check `.eq('status', 'approved')` before showing anything.

Since there are no SQL migrations in-repo, treat the live Supabase schema as the source of truth for column names — grep `src/*.jsx` for `.from('table_name')` and `.select(...)` calls to find current fields in use before adding new columns.

### Recipe import pipeline (`api/*.js` + `AddRecipe.jsx`)
Four ways to add a recipe, each a separate serverless endpoint that all funnel into the same Claude extraction pattern (build a prompt, call `api.anthropic.com/v1/messages` with `ANTHROPIC_API_KEY`, parse the JSON `{title, ingredients, instructions, cook_time, difficulty, source_name}` out of the response text):
- `api/scan-recipe.js` — photo(s) of a recipe (e.g. a cookbook page), sent as base64 images to Claude.
- `api/extract-recipe-url.js` — arbitrary recipe URL; scrapes and strips HTML tags (with a special-cased Substack API path for full post text) before sending page text to Claude. Page text is capped at 60,000 chars.
- `api/import-social.js` — TikTok/Instagram links; pulls the caption via oEmbed (TikTok) or an og:description scrape (Instagram, since IG oEmbed needs a token), then extracts a recipe from the caption text.
- `api/fetch-og-image.js` — grabs a thumbnail via `og:image`/`twitter:image` meta tags for link previews.

All four are unauthenticated POST endpoints that trust `req.body` directly — there's no auth check in these handlers today, so don't assume caller identity is verified there.

When changing the JSON contract these functions return, update the parsing logic in `AddRecipe.jsx` (the `fetch('/api/...')` call sites) in the same change — they're tightly coupled and not typed.

### Supabase Edge Functions (`supabase/functions/`)
`notify-new-signup` and `welcome-email` are Deno-based Postgres webhook triggers (fired on new rows in a signups/profiles table) that send email via Resend. These are deployed separately from the Vite app via the Supabase CLI, not via `npm run build`.

### Native iOS app (Capacitor)
`ios/` (once generated via `npx cap add ios` — see below) is a real Xcode project that ships the built `dist/` output locally inside a WKWebView shell, configured via `capacitor.config.json` (`appId: com.nomrecipeapp.nom`). It does **not** point at a remote URL — Apple review treats bare website wrappers unfavorably, so the app bundle is self-contained and only reaches out over the network for Supabase and `api/*` calls, exactly like the web app does.

Because the native shell has no browser origin, the relative `fetch('/api/...')` calls used throughout `AddRecipe.jsx` are routed through `API_BASE` (exported from `src/supabase.js`, reads `VITE_API_BASE_URL`). That env var is only set in the local `.env.local` (`https://www.nomrecipeapp.com`) used when building the app that feeds `npx cap sync ios` — it's intentionally unset in the Vercel web deploy, where relative paths keep resolving against the page's own origin unchanged.

Building/updating the native app: `npm run build && npx cap sync ios`, then work in `ios/App/App.xcworkspace` in Xcode. Auth here is plain email/password (no OAuth), and password reset redirects to the web domain and completes in mobile Safari — so there's no custom URL scheme or universal-links handling wired up, and none is needed for the existing flows.
