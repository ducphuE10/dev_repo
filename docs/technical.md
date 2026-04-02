# Dupe Hunt — Technical Spec (MVP v1)
**Date:** 2026-04-02
**Branch:** feature/dupe-hunt-design

---

## 1. Repository Structure

```
dupe-hunt/
├── apps/
│   ├── mobile/          # React Native (Expo) — iOS + Android
│   ├── web/             # Next.js 14 — SEO/browse layer
│   └── api/             # Node.js + Fastify — REST API
├── packages/
│   ├── db/              # Drizzle ORM schema + migrations
│   ├── types/           # Shared TypeScript types
│   └── config/          # Shared ESLint, TSConfig
├── docs/
│   ├── design.md
│   ├── technical.md     ← this file
│   └── plan.md
├── turbo.json
└── package.json
```

**Monorepo tool:** Turborepo  
**Package manager:** pnpm  
**Language:** TypeScript throughout

---

## 2. Environment Variables

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=dupe-hunt-media
TYPESENSE_HOST=...
TYPESENSE_API_KEY=...
AFFILIATE_WRAPPING_DOMAIN=https://go.dupehunt.com
OCR_SERVICE_KEY=...         # e.g. Google Vision API
PORT=3001
NODE_ENV=production
```

### Web (`apps/web/.env`)
```env
NEXT_PUBLIC_API_URL=https://api.dupehunt.com
NEXT_PUBLIC_APP_URL=https://dupehunt.com
```

### Mobile (`apps/mobile/.env`)
```env
EXPO_PUBLIC_API_URL=https://api.dupehunt.com
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 3. Database Schema

### 3.1 Full SQL Schema

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              VARCHAR(30) UNIQUE NOT NULL,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  avatar_url            TEXT,
  bio                   VARCHAR(160),
  verified_buy_count    INTEGER DEFAULT 0,
  total_upvotes         INTEGER DEFAULT 0,
  contributor_tier      VARCHAR(20) DEFAULT 'standard',
    -- values: 'standard' | 'top_contributor'
  posts_per_day_count   INTEGER DEFAULT 0,
  last_post_date        DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_active_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  slug        VARCHAR(50) UNIQUE NOT NULL,
  icon        VARCHAR(10),          -- emoji icon
  post_count  INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE
);

-- Seed data
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Beauty & Skincare', 'beauty',  '💄', 1),
  ('Fashion & Clothing','fashion', '👗', 2),
  ('Tech Accessories',  'tech',    '💻', 3),
  ('Home & Decor',      'home',    '🏠', 4),
  ('Food & Drinks',     'food',    '🍔', 5);

-- ─────────────────────────────────────────
-- POSTS
-- ─────────────────────────────────────────
CREATE TABLE posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id           INTEGER NOT NULL REFERENCES categories(id),

  -- Original product
  original_product_name VARCHAR(100) NOT NULL,
  original_brand        VARCHAR(100),
  original_price        DECIMAL(10,2),
  original_currency     CHAR(3) DEFAULT 'USD',

  -- Dupe product
  dupe_product_name     VARCHAR(100) NOT NULL,
  dupe_brand            VARCHAR(100),
  dupe_price            DECIMAL(10,2),
  dupe_currency         CHAR(3) DEFAULT 'USD',

  -- Computed
  price_saved           DECIMAL(10,2) GENERATED ALWAYS AS
                          (original_price - dupe_price) STORED,

  -- Media
  media_type            VARCHAR(10) NOT NULL CHECK (media_type IN ('video','photo')),
  media_urls            JSONB NOT NULL,   -- string[]

  -- Content
  review_text           VARCHAR(280),
  affiliate_link        TEXT,
  affiliate_platform    VARCHAR(50),

  -- Engagement
  upvote_count          INTEGER DEFAULT 0,
  downvote_count        INTEGER DEFAULT 0,
  flag_count            INTEGER DEFAULT 0,

  -- Verification
  is_verified_buy       BOOLEAN DEFAULT FALSE,
  receipt_url           TEXT,            -- encrypted, private
  receipt_verified_at   TIMESTAMPTZ,

  -- Status
  status                VARCHAR(20) DEFAULT 'active'
                          CHECK (status IN ('active','flagged','removed')),

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX posts_category_id_idx    ON posts(category_id);
CREATE INDEX posts_user_id_idx        ON posts(user_id);
CREATE INDEX posts_created_at_idx     ON posts(created_at DESC);
CREATE INDEX posts_upvote_count_idx   ON posts(upvote_count DESC);
CREATE INDEX posts_status_idx         ON posts(status);
CREATE INDEX posts_is_verified_idx    ON posts(is_verified_buy);

-- ─────────────────────────────────────────
-- UPVOTES / DOWNVOTES
-- ─────────────────────────────────────────
CREATE TABLE upvotes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX upvotes_post_id_idx ON upvotes(post_id);

CREATE TABLE downvotes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX downvotes_post_id_idx ON downvotes(post_id);

-- ─────────────────────────────────────────
-- FLAGS
-- ─────────────────────────────────────────
CREATE TABLE flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason     VARCHAR(50) NOT NULL
               CHECK (reason IN ('spam','fake','inappropriate','affiliate_abuse')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX flags_post_id_idx ON flags(post_id);

-- ─────────────────────────────────────────
-- SAVES (bookmarks)
-- ─────────────────────────────────────────
CREATE TABLE saves (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─────────────────────────────────────────
-- FOLLOWS
-- ─────────────────────────────────────────
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- ─────────────────────────────────────────
-- USER CATEGORY PREFERENCES
-- ─────────────────────────────────────────
CREATE TABLE user_categories (
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (user_id, category_id)
);

-- ─────────────────────────────────────────
-- AFFILIATE CLICKS
-- ─────────────────────────────────────────
CREATE TABLE affiliate_clicks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id            UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id         VARCHAR(100),
  affiliate_platform VARCHAR(50),
  clicked_at         TIMESTAMPTZ DEFAULT NOW(),
  converted_at       TIMESTAMPTZ,
  commission_amount  DECIMAL(10,4)
);
CREATE INDEX affiliate_clicks_post_id_idx  ON affiliate_clicks(post_id);
CREATE INDEX affiliate_clicks_clicked_at_idx ON affiliate_clicks(clicked_at DESC);
```

---

## 4. API Endpoints

**Base URL:** `https://api.dupehunt.com/v1`  
**Auth:** Bearer JWT token in `Authorization` header  
**Pagination:** Cursor-based (`?cursor=<post_id>&limit=20`)

---

### 4.1 Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register with email + password |
| POST | `/auth/login` | None | Login, returns JWT + refresh token |
| POST | `/auth/logout` | Required | Invalidate refresh token |
| POST | `/auth/refresh` | None | Exchange refresh token for new JWT |
| POST | `/auth/oauth/google` | None | Google OAuth callback |
| POST | `/auth/oauth/apple` | None | Apple OAuth callback |

**POST /auth/register**
```json
// Request
{ "username": "zoe_dupes", "email": "zoe@example.com", "password": "..." }

// Response 201
{ "user": { "id": "...", "username": "zoe_dupes" }, "token": "...", "refresh_token": "..." }
```

---

### 4.2 Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | Required | Get current user profile |
| PATCH | `/users/me` | Required | Update username, bio, avatar |
| GET | `/users/:id` | Optional | Get public user profile |
| GET | `/users/me/saves` | Required | Get saved posts |
| GET | `/users/me/categories` | Required | Get selected categories |
| PUT | `/users/me/categories` | Required | Replace category preferences |
| POST | `/users/:id/follow` | Required | Follow a user |
| DELETE | `/users/:id/follow` | Required | Unfollow a user |

---

### 4.3 Posts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/posts` | Optional | Paginated feed |
| POST | `/posts` | Required | Create new post |
| GET | `/posts/:id` | Optional | Get single post |
| DELETE | `/posts/:id` | Required | Delete own post |
| POST | `/posts/:id/upvote` | Required | Upvote a post |
| DELETE | `/posts/:id/upvote` | Required | Remove upvote |
| POST | `/posts/:id/downvote` | Required | Downvote a post |
| DELETE | `/posts/:id/downvote` | Required | Remove downvote |
| POST | `/posts/:id/save` | Required | Save a post |
| DELETE | `/posts/:id/save` | Required | Unsave a post |
| POST | `/posts/:id/flag` | Required | Flag a post |
| POST | `/posts/:id/verify` | Required | Upload receipt for verification |

**GET /posts query params:**
```
tab=for_you|trending|new     (default: for_you)
category=beauty|fashion|...  (optional filter)
verified=true                (optional filter)
cursor=<uuid>                (pagination)
limit=20                     (max 50)
```

**POST /posts request body:**
```json
{
  "category_id": 1,
  "original_product_name": "Charlotte Tilbury Flawless Filter",
  "original_brand": "Charlotte Tilbury",
  "original_price": 49.00,
  "dupe_product_name": "e.l.f. Halo Glow Liquid Filter",
  "dupe_brand": "e.l.f.",
  "dupe_price": 14.00,
  "media_type": "photo",
  "media_urls": ["https://r2.dupehunt.com/posts/abc123/1.jpg"],
  "review_text": "Literally identical finish, saved $35!",
  "affiliate_link": "https://amazon.com/..."
}
```

---

### 4.4 Upload

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload/media` | Required | Get presigned R2 URL for media upload |
| POST | `/upload/receipt` | Required | Upload receipt image for OCR verification |

**POST /upload/media response:**
```json
{
  "upload_url": "https://r2.cf.com/presigned-url...",
  "media_url": "https://media.dupehunt.com/posts/abc123/1.jpg",
  "expires_in": 300
}
```

---

### 4.5 Search

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/search` | Optional | Full-text search posts |
| GET | `/search/trending` | Optional | Trending search terms |

**GET /search query params:**
```
q=stanley cup          (search query)
category=home          (optional)
verified=true          (optional)
sort=upvotes|newest    (default: upvotes)
cursor=...
limit=20
```

---

### 4.6 Categories

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/categories` | None | List all active categories |

---

### 4.7 Affiliate

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/affiliate/go/:postId` | None | Track click + redirect to affiliate URL |

This endpoint records the click in `affiliate_clicks`, then issues a `302` redirect to the wrapped affiliate link.

---

### 4.8 Admin / Moderation (internal only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/flags` | Admin | List flagged posts queue |
| PATCH | `/admin/posts/:id` | Admin | Update post status (remove/restore) |
| GET | `/admin/stats` | Admin | Basic platform stats |

---

## 5. Mobile Screen Map

### 5.1 Navigation Structure

```
App
├── Auth Stack (unauthenticated)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
│
├── Onboarding Stack (post-auth, first launch only)
│   ├── CategorySelectScreen
│   └── OnboardingCompleteScreen
│
└── Main Tab Navigator (authenticated)
    ├── Tab: Home
    │   ├── FeedScreen              ← default
    │   └── DupePageScreen          ← push
    │
    ├── Tab: Search
    │   ├── SearchScreen            ← default
    │   ├── SearchResultsScreen     ← push
    │   └── DupePageScreen          ← push
    │
    ├── Tab: Post (+)
    │   ├── PostFormatScreen        ← modal
    │   ├── MediaCaptureScreen      ← push
    │   ├── PostFormScreen          ← push
    │   ├── ReceiptUploadScreen     ← push (optional)
    │   └── PostPreviewScreen       ← push
    │
    ├── Tab: Notifications
    │   └── NotificationsScreen     ← default (v2)
    │
    └── Tab: Profile
        ├── ProfileScreen           ← default (own)
        ├── EditProfileScreen       ← push
        ├── SavedCollectionScreen   ← push
        ├── SettingsScreen          ← push
        └── PublicProfileScreen     ← push (other users)
```

### 5.2 Screen Descriptions

| Screen | Key Components |
|---|---|
| **WelcomeScreen** | Logo, "Sign up" CTA, "Log in" link, Google/Apple SSO buttons |
| **FeedScreen** | Tab bar (For You / Trending / New), PostCard list, category filter chips, search bar |
| **DupePageScreen** | Original vs dupe side-by-side, price saved badge, "Buy This Dupe" CTA, community posts list, upvote/downvote, share |
| **SearchScreen** | Search input, trending keywords, category pills |
| **SearchResultsScreen** | Filtered PostCard list, sort/filter drawer |
| **PostFormatScreen** | "Video" or "Photo" selection (modal bottom sheet) |
| **MediaCaptureScreen** | Camera view with record/capture, gallery picker |
| **PostFormScreen** | Original product fields, dupe product fields, category picker, review text, affiliate link |
| **ReceiptUploadScreen** | Image picker, OCR status indicator, skip option |
| **PostPreviewScreen** | Full preview of post, "Publish" button |
| **ProfileScreen** | Avatar, username, stats (posts, upvotes, verified buys), post grid, badges |
| **SavedCollectionScreen** | Saved posts in a grid, category filter |
| **SettingsScreen** | Account, notifications (v2), privacy, logout, delete account |

---

## 6. Web Pages (Next.js)

| Route | Description | SSR |
|---|---|---|
| `/` | Homepage — trending posts feed, category nav | Yes |
| `/[category]` | Category browse page | Yes |
| `/post/[id]` | Individual post / dupe page | Yes |
| `/user/[username]` | Public user profile | Yes |
| `/search` | Search results (SSR for SEO) | Yes |
| `/sitemap.xml` | Auto-generated sitemap | — |

All web pages are **browse-only**. A banner prompts users to download the app to post.

**SEO targets per page:**
- `<title>`: `Best dupe for {original_product_name} — Dupe Hunt`
- `<meta description>`: `"{dupe_product_name}" by {dupe_brand} at ${dupe_price}. Verified by community. Save ${price_saved}.`
- OG image: Auto-generated card with original vs dupe side-by-side

---

## 7. Affiliate Link Flow

```
1. User submits post with affiliate_link
2. API wraps it:
   affiliate_link → https://go.dupehunt.com/go/{postId}
   (stored as-is in DB; wrapping happens at redirect time)

3. User taps "Buy This Dupe" in app or web
4. App/web calls: GET /affiliate/go/{postId}
5. API:
   a. Inserts row in affiliate_clicks (post_id, user_id, session_id, clicked_at)
   b. Appends affiliate tracking param to original URL
      e.g. ?tag=dupehunt-20 (Amazon Associates)
   c. Returns 302 redirect to affiliate URL

6. Conversion tracked via affiliate platform webhook → updates converted_at + commission_amount
```

**Supported platforms (v1):**
- Amazon Associates (`?tag=dupehunt-20`)
- Generic UTM fallback (`?utm_source=dupehunt&utm_medium=affiliate`)

---

## 8. Receipt Verification Flow

```
1. User optionally uploads receipt image after posting
2. Image uploaded to Cloudflare R2 (private bucket, path: receipts/{userId}/{postId}.jpg)
3. Worker job triggered (BullMQ):
   a. Run Google Vision OCR on image
   b. Check for: merchant name OR product keyword + purchase date within 90 days
   c. If passes: set is_verified_buy=true, receipt_verified_at=NOW()
   d. If fails: notify user via in-app notification, post remains unverified
4. Receipt image is NEVER exposed publicly — only used for OCR, then retained encrypted
```

---

## 9. Feed Ranking Algorithm (v1)

**For You tab** — category-filtered, scored by:
```
score = upvote_count
      + (is_verified_buy ? 10 : 0)
      + recency_boost  -- posts < 24hrs old get +5
```
Posts fetched from user's selected categories, ordered by score DESC.

**Trending tab** — all categories, last 24 hours, ordered by upvote_count DESC.

**New tab** — all categories, ordered by created_at DESC.

No ML in v1. Algorithm is deterministic and easy to debug.

---

## 10. Background Jobs (BullMQ)

| Job | Trigger | Description |
|---|---|---|
| `process-video` | Post created with media_type=video | Transcode via FFmpeg, generate thumbnail, update media_urls |
| `verify-receipt` | Receipt uploaded | OCR check, update is_verified_buy |
| `wrap-affiliate-link` | Post created with affiliate_link | Validate URL, apply affiliate tag |
| `update-post-counts` | Upvote/downvote/flag event | Increment counters on posts table |
| `update-user-tier` | Verified buy count changes | Check if user qualifies for top_contributor |
| `auto-flag-review` | flag_count reaches 5 | Set post status=flagged, add to moderation queue |

---

*Technical spec written by Zenith Agent · 2026-04-02*
