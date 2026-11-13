# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nom — a personal cookbook / recipe social app ("Pinterest meets Goodreads for recipes"). Users save recipes, log what they cook, mark a verdict (Would Make Again / It Was Fine / Never Again), follow friends, and see a feed of what friends are cooking. It ships mainly as a native iOS app (Capacitor, on the App Store since Nov 2026); the same code also runs as the website at nomrecipeapp.com, plus a private Admin page at `/admin`.

Pushing to `main` deploys the website straight to real users via Vercel (no staging site), so build-test before every push. iOS releases ship separately through Xcode and App Store Connect.

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
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side Supabase config, read in `src/supabase.js`. Despite the name, `VITE_SUPABASE_ANON_KEY` now holds the newer publishable key (Nov 2026 key rotation).
- `VITE_API_BASE_URL` — set only in `.env.local` for iOS builds (see Native iOS app below).
- Server-side only (Vercel env vars, used by `api/*.js`, never exposed to the client): `ANTHROPIC_API_KEY`, `SPOONACULAR_KEY` (Spoonacular is called from `api/spoonacular-extract.js`, not the browser), `NOM_ADMIN_SECRET`.
- Supabase Edge Functions (`supabase/functions/*`) use Supabase secrets: `RESEND_API_KEY` for email via Resend, `SUPABASE_SECRET_KEYS` for admin access, and `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_PRIVATE_KEY` for push notifications.

## Architecture

### Screen navigation (no router)
`src/App.jsx` is the entire navigation system: a `screen` string in `useState` picks which top-level component renders (`'feed' | 'cookbook' | 'search' | 'profile' | 'recipe' | 'socialRecipe' | 'friendRecipeDetail' | 'friendProfile' | 'followList' | 'notifications' | 'add' | 'resetPassword'`). Navigating calls `pushNav()`, which saves a snapshot (screen, what was open, scroll position) onto a back-history stack in `navRef`; Back (button or iOS swipe) pops the last snapshot, and tapping a bottom tab starts a fresh history via `goTab()`. There's no URL sync except for one-off deep-link params (`?code=`, `?recipe=`, `?cook=`) read once on mount and resolved via `pendingRecipeId`/`pendingCookId` effects. When adding a new screen, follow this same pattern rather than introducing a router.

Auth/onboarding gating happens at the top of `App.jsx`'s render: `loading` → `!session` → `!onboardingComplete` gate which component tree renders. `onboarding_complete` lives in the `profiles` table, not on the Supabase auth user.

### Data model (inferred from Supabase table usage — no migrations checked into this repo)
Tables queried from the client: `profiles`, `recipes`, `cooks`, `follows`, `notifications`, `comments`, `likes`, `invites`, `recipe_views`. Storage buckets: `avatars`, `recipe-images`, `cook-photos`.

Key relationship: a `recipe` is the cookbook entry (title, ingredients, instructions); a `cook` is a logged instance of making it (photo, verdict, ratings, timestamp) and is what shows up in the social feed. `follows` has a `status` column (`'approved'` vs pending) — the app is follow-request-gated, not open-follow, so most friend-content queries check `.eq('status', 'approved')` before showing anything.

Since there are no SQL migrations in-repo, treat the live Supabase schema as the source of truth for column names — grep `src/*.jsx` for `.from('table_name')` and `.select(...)` calls to find current fields in use before adding new columns.

### Recipe import pipeline (`api/*.js` + `AddRecipe.jsx`)
Each import route is a separate serverless endpoint (model: `claude-sonnet-4-6`) that all funnel into the same Claude extraction pattern (build a prompt, call `api.anthropic.com/v1/messages` with `ANTHROPIC_API_KEY`, parse the JSON `{title, ingredients, instructions, cook_time, difficulty, source_name}` out of the response text):
- `api/scan-recipe.js` — photo(s) of a recipe (e.g. a cookbook page), sent as base64 images to Claude.
- `api/extract-recipe-url.js` — arbitrary recipe URL; scrapes and strips HTML tags (with a special-cased Substack API path for full post text) before sending page text to Claude. Page text is capped at 60,000 chars.
- `api/import-social.js` — TikTok/Instagram links; pulls the caption via oEmbed (TikTok) or an og:description scrape (Instagram, since IG oEmbed needs a token), then extracts a recipe from the caption text.
- `api/fetch-og-image.js` — grabs a thumbnail via `og:image`/`twitter:image` meta tags for link previews.

- `api/spoonacular-extract.js` — server-side Spoonacular lookup, so the key stays off the client.

Shared helpers live in `api/_*.js` (files starting with `_` aren't deployed as routes). `api/_auth.js` has `handleCors()` (lets the iOS app at `capacitor://localhost` call the endpoints) and `requireUser()`, which checks the Supabase session token in `Authorization: Bearer <token>` and returns 401 otherwise. Every endpoint requires a signed-in Nom user, so new endpoints that hit paid services must call both. AI imports also have a daily per-user cap (40/day in a user's first week, 10/day after) and log their real cost for the Admin page.

When changing the JSON contract these functions return, update the parsing logic in `AddRecipe.jsx` (the `fetch('/api/...')` call sites) in the same change — they're tightly coupled and not typed.

### Supabase Edge Functions (`supabase/functions/`)
Deno functions, deployed separately from the Vite app with the Supabase CLI (`supabase functions deploy <name>`), not with `npm run build` or a push to main. Email templates are shared in `_shared/emails.ts`, so editing one means redeploying every function that uses it.
- Email via Resend: `welcome-email`, `send-invite`, `send-announcement`, `budget-alert`, plus alerts to Syd: `notify-new-signup`, `notify-new-waitlist`, `notify-new-report`.
- `send-push` — Apple push notifications, fired by a Database Webhook on `notifications` inserts; device tokens live in `device_tokens`.
- `delete-account` — deletes the user and their files in the Storage buckets.
Most are fired by Supabase Database Webhooks rather than called from the app.

### Native iOS app (Capacitor)
`ios/` is a real Xcode project that ships the built `dist/` output locally inside a WKWebView shell, configured via `capacitor.config.json` (`appId: com.nomrecipeapp.nom`). It does **not** point at a remote URL — Apple review treats bare website wrappers unfavorably, so the app bundle is self-contained and only reaches out over the network for Supabase and `api/*` calls, exactly like the web app does.

Because the native shell has no browser origin, the relative `fetch('/api/...')` calls used throughout `AddRecipe.jsx` are routed through `API_BASE` (exported from `src/supabase.js`, reads `VITE_API_BASE_URL`). That env var is only set in the local `.env.local` (`https://www.nomrecipeapp.com`) used when building the app that feeds `npx cap sync ios` — it's intentionally unset in the Vercel web deploy, where relative paths keep resolving against the page's own origin unchanged.

Building/updating the native app: `npm run build && npx cap sync ios`, then open `ios/App/App.xcodeproj` in Xcode. Capacitor 8 uses Swift Package Manager, so there is no `App.xcworkspace` and no CocoaPods. `ios/App/CapApp-SPM/Package.swift` is generated by `npx cap sync`, so don't edit it by hand. Keep `@capacitor/core`, `@capacitor/ios` and `@capacitor/cli` on the same version.

Native plugins in use: Preferences (stores the sign-in on the phone instead of browser storage), Browser (in-app browser for recipe and legal links), Haptics, Push Notifications, Status Bar, and in-app review. Use `Capacitor.isNativePlatform()` to branch iOS-only behavior; the website keeps working without it.

Auth is plain email/password (no OAuth yet; Sign in with Apple is planned for 1.0.4). Password reset redirects to the web domain and completes in mobile Safari. Associated Domains has `webcredentials:www.nomrecipeapp.com` for password autofill only. There's no custom URL scheme or universal-links handling.
