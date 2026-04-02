# Dupe Hunt — Implementation Plan (MVP v1)
**Date:** 2026-04-02
**Target:** Shippable v1 in ~10 weeks
**Stack:** React Native (Expo) · Next.js · Fastify · PostgreSQL · Redis

---

## Overview

10 phases, executed in dependency order. Each phase has a clear output and unblocks the next.

```
Phase 0 → Phase 1 → Phase 2 → Phase 3
                            → Phase 4  → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
```

Phases 3 and 4 can run in parallel once Phase 2 is complete.

---

## Phase 0 — Project Setup
**Duration:** Week 1  
**Output:** All repos scaffolded, CI running, dev environment works end-to-end

### Tasks
- [ ] Initialize Turborepo monorepo with pnpm workspaces
- [ ] Scaffold `apps/api` — Node.js + Fastify + TypeScript
- [ ] Scaffold `apps/mobile` — Expo (React Native) + TypeScript
- [ ] Scaffold `apps/web` — Next.js 14 App Router + TypeScript
- [ ] Scaffold `packages/db` — Drizzle ORM + migration setup
- [ ] Scaffold `packages/types` — shared TypeScript interfaces
- [ ] Provision PostgreSQL on Railway (dev + prod)
- [ ] Provision Redis on Railway (dev + prod)
- [ ] Set up Supabase project (Auth)
- [ ] Set up Cloudflare R2 buckets: `dupe-hunt-media` (public) + `dupe-hunt-receipts` (private)
- [ ] Set up Typesense instance
- [ ] Configure GitHub Actions CI: lint + typecheck on every PR
- [ ] Set up `.env` files for all apps (from `docs/technical.md` env section)
- [ ] Write `turbo.json` build pipeline

**Done when:** `pnpm dev` starts all three apps; API returns 200 on `/health`

---

## Phase 1 — Database & Core API
**Duration:** Week 2  
**Output:** Full database schema live, auth working, core CRUD endpoints returning real data

### Tasks
- [ ] Write all migration files from `docs/technical.md` schema
  - `001_create_users.sql`
  - `002_create_categories.sql`
  - `003_create_posts.sql`
  - `004_create_upvotes_downvotes.sql`
  - `005_create_flags.sql`
  - `006_create_saves.sql`
  - `007_create_follows.sql`
  - `008_create_user_categories.sql`
  - `009_create_affiliate_clicks.sql`
- [ ] Run migrations and seed category data (5 categories)
- [ ] Write Drizzle ORM models for all tables
- [ ] Implement auth endpoints: `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`
- [ ] Integrate Supabase Auth for Google + Apple OAuth: `POST /auth/oauth/google`, `/auth/oauth/apple`
- [ ] JWT middleware (verify token on protected routes)
- [ ] Rate limiting middleware (Redis-backed, per IP + per user)
- [ ] Implement user endpoints: `GET /users/me`, `PATCH /users/me`, `GET /users/:id`
- [ ] Implement category endpoint: `GET /categories`
- [ ] Implement user category preferences: `GET /users/me/categories`, `PUT /users/me/categories`
- [ ] Implement follow endpoints: `POST /users/:id/follow`, `DELETE /users/:id/follow`
- [ ] Write integration tests for all auth + user endpoints

**Done when:** Postman/curl can register, login, and fetch user profile with real DB data

---

## Phase 2 — Post Creation API + Media Upload
**Duration:** Week 2–3  
**Output:** Posts can be created via API with media; feed endpoint returns paginated posts

### Tasks
- [ ] Implement `POST /upload/media` — generate presigned Cloudflare R2 URL
- [ ] Implement `POST /posts` — create post, validate fields, store in DB
- [ ] Implement `GET /posts/:id` — fetch single post with user + category data
- [ ] Implement `DELETE /posts/:id` — soft delete (status=removed), owner only
- [ ] Implement `GET /posts` feed endpoint with:
  - `tab` param: `for_you` | `trending` | `new`
  - `category` filter
  - `verified` filter
  - Cursor-based pagination
  - Feed ranking algorithm (see `docs/technical.md` section 9)
- [ ] Set up BullMQ worker infrastructure
- [ ] Implement `process-video` job — FFmpeg transcoding + thumbnail generation
- [ ] Implement `wrap-affiliate-link` job — URL validation + affiliate tag injection
- [ ] Cache trending feed in Redis (TTL: 5 minutes)
- [ ] Write integration tests for post creation + feed

**Done when:** A post with photo can be created via API and appears in the feed response

---

## Phase 3 — Mobile App: Auth + Onboarding + Feed
**Duration:** Week 3–4  
**Output:** Working mobile app — user can sign up, pick categories, browse feed

### Tasks
- [ ] Set up React Navigation: Auth Stack + Onboarding Stack + Main Tab Navigator
- [ ] Implement `WelcomeScreen` — logo, sign up CTA, log in link
- [ ] Implement `RegisterScreen` — email/password form, Google/Apple SSO buttons
- [ ] Implement `LoginScreen` — email/password + SSO
- [ ] Implement `CategorySelectScreen` — multi-select category chips, min 1 required
- [ ] Implement `OnboardingCompleteScreen` — welcome message, transition to feed
- [ ] Implement `FeedScreen`:
  - Tab bar (For You / Trending / New)
  - Category filter chips (horizontal scroll)
  - `PostCard` component (thumbnail, product names, price saved, upvote count, verified badge)
  - Infinite scroll with cursor pagination
  - Pull-to-refresh
- [ ] Implement `DupePageScreen`:
  - Original vs dupe side-by-side cards
  - Price saved badge
  - "Buy This Dupe" button → calls `/affiliate/go/:postId` → deep link
  - Community posts list (same dupe, other reviews)
  - Upvote / Downvote buttons
  - Share button (generates deep link URL)
- [ ] API client setup (Axios + React Query for caching + loading states)
- [ ] Auth token storage (Expo SecureStore)
- [ ] Global auth state (Zustand or React Context)

**Done when:** User can install app, sign up, pick categories, scroll feed, and tap into a dupe page

---

## Phase 4 — Mobile App: Post Creation
**Duration:** Week 4–5  
**Output:** User can create a post (photo or video) from the mobile app

### Tasks
- [ ] Implement `PostFormatScreen` — bottom sheet modal, "Video" or "Photo" selection
- [ ] Implement `MediaCaptureScreen`:
  - Camera view using `expo-camera`
  - Photo capture
  - Video record (max 60s) with progress bar
  - Gallery picker alternative (`expo-image-picker`)
  - Preview before proceeding
- [ ] Implement `PostFormScreen`:
  - Original product: name, brand, price fields
  - Dupe product: name, brand, price fields
  - Category picker (bottom sheet)
  - Review text (280 char limit with counter)
  - Affiliate link input (auto-detects if valid URL)
- [ ] Implement `ReceiptUploadScreen`:
  - Image picker for receipt photo
  - Upload progress indicator
  - "Skip for now" option
  - OCR status message ("Verifying your purchase...")
- [ ] Implement `PostPreviewScreen` — full post preview, "Publish" button
- [ ] Wire up media upload flow:
  - Call `POST /upload/media` → get presigned URL
  - Upload directly to Cloudflare R2
  - Then call `POST /posts` with returned `media_url`
- [ ] Show upload progress (bytes transferred)
- [ ] Error handling: network failure, upload timeout, validation errors

**Done when:** A user can record/take a photo, fill in the form, and publish a post that appears in the feed

---

## Phase 5 — Social Layer (Upvotes, Flags, Saves, Profiles)
**Duration:** Week 5  
**Output:** Full social interactions working in app and API

### Tasks
- [ ] API: Implement `POST /posts/:id/upvote`, `DELETE /posts/:id/upvote`
- [ ] API: Implement `POST /posts/:id/downvote`, `DELETE /posts/:id/downvote`
- [ ] API: Implement `POST /posts/:id/save`, `DELETE /posts/:id/save`
- [ ] API: Implement `POST /posts/:id/flag` with reason enum
- [ ] API: Implement `GET /users/me/saves`
- [ ] Worker: Implement `update-post-counts` job (upvote/downvote/flag counter sync)
- [ ] Worker: Implement `auto-flag-review` job (flag_count >= 5 → set status=flagged)
- [ ] Worker: Implement `update-user-tier` job (top_contributor qualification check)
- [ ] Mobile: Upvote/downvote buttons with optimistic UI on `DupePageScreen` + `PostCard`
- [ ] Mobile: Save button on `DupePageScreen`
- [ ] Mobile: Flag button on `DupePageScreen` (bottom sheet with reason selection)
- [ ] Mobile: Implement `ProfileScreen` — avatar, stats, post grid, badges
- [ ] Mobile: Implement `PublicProfileScreen` — view other users, follow button
- [ ] Mobile: Implement `EditProfileScreen` — avatar upload, username, bio
- [ ] Mobile: Implement `SavedCollectionScreen` — saved posts grid

**Done when:** Full upvote/save/flag loop works; profile shows accurate stats

---

## Phase 6 — Search
**Duration:** Week 6  
**Output:** Search is fast, typo-tolerant, and filterable

### Tasks
- [ ] Set up Typesense collection schema for posts
- [ ] Write post indexing worker — sync new/updated posts to Typesense on create/update/delete
- [ ] Backfill existing posts into Typesense index
- [ ] API: Implement `GET /search` with full-text search + filters (category, verified, sort)
- [ ] API: Implement `GET /search/trending` — top 10 searched terms (Redis sorted set)
- [ ] Mobile: Implement `SearchScreen` — search input, trending keywords, category pills
- [ ] Mobile: Implement `SearchResultsScreen`:
  - PostCard list
  - Sort/filter bottom drawer (category, verified only, newest/top)
  - Empty state with suggestions

**Done when:** Searching "stanley cup" returns relevant dupe posts instantly with typo tolerance

---

## Phase 7 — Affiliate System
**Duration:** Week 6–7  
**Output:** Every "Buy This Dupe" tap is tracked; affiliate revenue flow is live

### Tasks
- [ ] API: Implement `GET /affiliate/go/:postId` redirect endpoint
  - Log click to `affiliate_clicks`
  - Append affiliate tag to URL based on detected platform
  - Return 302 redirect
- [ ] Worker: `wrap-affiliate-link` — validate URL + inject affiliate tracking param on post creation
- [ ] Handle deep link on mobile: `dupehunt://affiliate/go/:postId` → open in browser
- [ ] Handle web click: `/affiliate/go/:postId` → server-side redirect
- [ ] Register with Amazon Associates (get tracking tag `dupehunt-20`)
- [ ] Register with ShareASale, Impact as backup platforms
- [ ] Admin stats endpoint: `GET /admin/stats` — clicks, conversions, commission totals
- [ ] Test full affiliate click → redirect → conversion tracking loop

**Done when:** Every "Buy This Dupe" tap records a row in `affiliate_clicks` and redirects correctly

---

## Phase 8 — Web Layer (Next.js)
**Duration:** Week 7–8  
**Output:** SEO-optimized web pages for discovery; shareable post links work

### Tasks
- [ ] Set up API client in Next.js (server-side fetch with cache)
- [ ] Implement `/` homepage — trending posts feed, category nav
- [ ] Implement `/[category]` — category browse with SSR
- [ ] Implement `/post/[id]` — dupe page with SSR:
  - Original vs dupe side-by-side
  - "Buy This Dupe" CTA
  - Community reviews list
  - App download banner
- [ ] Implement `/user/[username]` — public profile with SSR
- [ ] Implement `/search` — SSR search results page
- [ ] SEO metadata on every page (title, description, OG tags)
- [ ] OG image generation (`next/og`) — original vs dupe card
- [ ] Generate `sitemap.xml` — all active post + category pages
- [ ] Generate `robots.txt`
- [ ] App download banner component (sticky, dismissible)
- [ ] Responsive mobile-first layout for web

**Done when:** A post shared as a link shows a rich preview in iMessage/Twitter/Discord and ranks on Google

---

## Phase 9 — Receipt Verification + Moderation + Polish
**Duration:** Week 8–10  
**Output:** Verified Buy system works; moderation queue live; app ready for TestFlight/Play Beta

### Tasks

**Receipt Verification:**
- [ ] API: Implement `POST /upload/receipt` — upload to private R2 bucket
- [ ] Worker: Implement `verify-receipt` job:
  - Call Google Vision OCR API on receipt image
  - Parse merchant + date fields
  - Pass/fail logic with 90-day date window
  - Update `is_verified_buy`, `receipt_verified_at` on post
- [ ] Mobile: Wire up `ReceiptUploadScreen` to API
- [ ] Mobile: Show verification status on post (pending / verified / failed)

**Moderation:**
- [ ] Profanity filter on `review_text` at post creation (API middleware)
- [ ] Duplicate post detection (same user + same original+dupe combo within 24hrs)
- [ ] Daily post cap enforcement (5 posts/day; 2 for accounts < 7 days old)
- [ ] Implement admin moderation queue endpoint `GET /admin/flags`
- [ ] Implement `PATCH /admin/posts/:id` to remove/restore posts
- [ ] Basic internal admin UI or Retool dashboard for moderation queue

**Polish:**
- [ ] Error boundaries in mobile app (crash-safe screens)
- [ ] Offline state handling (no internet banner)
- [ ] Loading skeletons on all list screens
- [ ] Empty states on all screens (first-time, no results)
- [ ] Haptic feedback on upvote/post actions (`expo-haptics`)
- [ ] App icon + splash screen design
- [ ] App Store listing copy + screenshots
- [ ] Privacy Policy page (required for App Store + receipt handling)
- [ ] Terms of Service page

**Launch:**
- [ ] Submit to TestFlight (iOS beta)
- [ ] Submit to Google Play Internal Testing (Android beta)
- [ ] Deploy web to production (Vercel or Cloudflare Pages)
- [ ] Deploy API to production (Railway)
- [ ] Set up error monitoring (Sentry on all three apps)
- [ ] Set up uptime monitoring (Better Uptime)

**Done when:** App passes TestFlight review; 10 beta users can post + browse + click affiliate links

---

## Timeline Summary

| Phase | Focus | Week |
|---|---|---|
| 0 | Setup & scaffolding | 1 |
| 1 | Database + auth API | 2 |
| 2 | Posts API + media upload | 2–3 |
| 3 | Mobile: auth + feed | 3–4 |
| 4 | Mobile: post creation | 4–5 |
| 5 | Social layer | 5 |
| 6 | Search | 6 |
| 7 | Affiliate system | 6–7 |
| 8 | Web (Next.js) | 7–8 |
| 9 | Verification + moderation + polish | 8–10 |

---

## Definition of Done (MVP v1)

A user can:
- [x] Sign up / log in (email or Google/Apple SSO)
- [x] Select preferred categories
- [x] Browse a feed of dupe posts (For You / Trending / New)
- [x] Search for a specific dupe
- [x] Post a dupe (photo or video) with product details
- [x] Optionally upload a receipt to earn Verified Buy badge
- [x] Upvote / downvote / save / flag posts
- [x] Tap "Buy This Dupe" and get redirected (affiliate tracked)
- [x] View their own profile with post history and stats
- [x] Share a dupe post link that previews on social media

---

*Implementation plan written by Zenith Agent · 2026-04-02*
