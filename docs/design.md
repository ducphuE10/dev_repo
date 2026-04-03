# Dupe Hunt — Production Design Spec
**Date:** 2026-04-02
**Status:** Approved for Implementation Planning
**Version:** 1.0

---

## 1. Product Overview

### Vision
Dupe Hunt is the first community-powered dupe discovery platform built for Gen Z — a place where real people share verified, honest reviews of affordable alternatives to expensive products across every category.

### Mission
Kill the fake review. Let the community decide what's actually worth buying.

### Tagline
> *"Real people. Real dupes. Real savings."*

### The Core Problem
- Existing dupe tools (Dupe.com, Brandefy, SkinSort) are **AI search tools**, not communities
- TikTok dupe content is **scattered, unverified, and mixed** with influencer spam
- Gen Z can't trust reviews — Amazon fakes, paid influencers, algorithm-gamed content
- No single destination exists for **multi-category, peer-verified dupe discovery**

### The Solution
A mobile-first, community-driven platform where Gen Z posts short video or photo reviews of dupes they've **actually purchased**, organized by category, surfaced by community upvotes — with affiliate links earning revenue on every click.

---

## 2. Target Users

### Primary Persona: "Savvy Zoe"
- Age: 18–27
- Financially conscious, style-aware
- Heavy TikTok/Instagram user
- Buys dupes regularly (71% of Gen Z does)
- Frustrated by fake reviews and paid influencer recommendations
- Values authenticity and peer trust over brand authority

### Secondary Persona: "Curious Creator"
- Same age range
- Wants to share finds and build a micro-reputation
- Motivated by upvotes, badges, and community recognition
- May grow into a power contributor

### Non-Target
- Brands (B2B brand analytics is a revenue stream, not a user)
- Older millennials / Gen X (secondary, not designed for)

---

## 3. Platform Strategy

### Primary: Mobile App (iOS + Android)
- The core experience — posting, feed browsing, searching, saving
- Camera-native for video/photo posting
- Push notifications for trending dupes, upvote milestones
- Built with React Native for cross-platform efficiency

### Secondary: Web (Responsive)
- SEO discovery layer — "best dupe for [product]" Google rankings
- Clean product/post pages for link sharing
- Browse-only experience; posting requires the app
- Built with Next.js for SSR/SEO performance

---

## 4. Core Features — MVP (v1)

### 4.1 Feed (Home Screen)
- Category-filtered home feed (user selects preferred categories on onboarding)
- Default tabs: **For You** (filtered by your selected categories, ranked by upvotes — no ML in v1) | **Trending** (most upvoted last 24hrs) | **New** (chronological)
- Each card shows: thumbnail, product name, dupe name, price saved, upvote count, verified badge (if applicable)
- Infinite scroll
- Persistent search bar at top

### 4.2 Categories (v1 Launch Set)
1. 💄 Beauty & Skincare
2. 👗 Fashion & Clothing
3. 💻 Tech Accessories
4. 🏠 Home & Decor
5. 🍔 Food & Drinks

Additional categories unlocked in v2 based on community demand.

### 4.3 Post a Dupe
**Flow:**
1. Tap "+" button
2. Choose format: **Video** (up to 60s) or **Photo** (up to 5 images)
3. Fill in:
   - Original product name + brand + price
   - Dupe product name + brand + price
   - Category
   - Short review (280 chars max)
   - Affiliate/purchase link (optional — auto-detected if pasted)
4. Optional: Upload receipt/order confirmation → earn ✅ **Verified Buy** badge
5. Post goes live immediately; verified posts get ranking boost

### 4.4 Verified Buy System (Tiered)
| Tier | How | Badge | Feed Ranking |
|---|---|---|---|
| Unverified | Just post | None | Standard |
| Verified Buy | Upload receipt/order screenshot | ✅ Verified Buy | +40% ranking boost |
| Top Contributor | 10+ verified posts, avg upvote ratio >80% | 🏆 Top Contributor | Featured placement |

Receipt images are stored securely, never shown publicly, reviewed by lightweight OCR to confirm purchase evidence.

### 4.5 Search
- Full-text search across original product name, dupe name, brand, category
- Trending searches shown by default
- Filters: Category, Price Saved (range), Verified Only, Newest / Most Upvoted
- Each result links to a **Dupe Page** (original vs dupe side-by-side)

### 4.6 Dupe Page
- Original product: name, brand, price, image
- Dupe product: name, brand, price, affiliate link (CTA: "Buy This Dupe")
- Price saved badge (e.g. "Save $78")
- Community posts about this dupe (all reviews)
- Upvote / Downvote count + upvote ratio
- Share button (deep link for web preview)

### 4.7 User Profile
- Avatar, username, bio
- Verified Buy count, Top Contributor badge (if earned)
- Post history
- Saved dupes collection (private)
- Following / Followers

### 4.8 Onboarding
1. Sign up (email or Google/Apple SSO)
2. Pick your categories (multi-select, min 1)
3. Optional: Connect receipt email for auto-verification (Gmail/Apple Mail OAuth) — skippable
4. Feed populated immediately with trending content

---

## 5. Content Moderation

### Automated Layer
- Profanity filter on text fields
- Duplicate post detection (same original + dupe combo within 24hrs by same user)
- OCR receipt check for verification (must show product purchase, date within 90 days)
- AI image moderation for NSFW content

### Community Layer
- Flag button on every post (categories: spam, fake, inappropriate, affiliate abuse)
- Posts with 5+ flags enter review queue
- Community downvotes surface low-quality content naturally

### Manual Layer
- Small moderation team reviews flagged content queue
- Appeals process via in-app support ticket
- Repeat violators: warning → temporary ban → permanent ban

### Anti-Spam Rules
- Max 5 posts per day per account (v1)
- Affiliate links limited to 1 per post
- New accounts (< 7 days) capped at 2 posts/day

---

## 6. Monetization

### 6.1 Affiliate Commissions (Day 1 Revenue)
- Every dupe product link is wrapped with an affiliate tracking link
- Platforms: Amazon Associates, ShareASale, Impact, CJ Affiliate
- When a user clicks "Buy This Dupe" and purchases → Dupe Hunt earns 3–15% commission
- Revenue split model (v2): Top Contributors earn 20% of affiliate revenue from their posts → incentivizes quality posting (see v2 scope)
- Estimated: $0.50–$3.00 average revenue per click-through purchase

### 6.2 Brand Analytics Dashboard (v2 Revenue — 6 months post-launch)
- Brands pay a monthly SaaS fee to access:
  - Sentiment analysis on their products (how often are they being "duped")
  - Dupe market share (which dupes are winning against them)
  - Demographic insights (which Gen Z segments buy dupes of their products)
  - Trend alerts (spike in dupe posts for a specific product)
- Pricing tiers:
  - Starter: $299/mo (1 brand, basic sentiment)
  - Growth: $799/mo (5 brands, trend alerts, demographic breakdown)
  - Enterprise: Custom (full API access, white-label reports)
- Target: 50 brand clients at avg $500/mo = $25K MRR at scale

### 6.3 Future Revenue (v3+)
- **Promoted dupes** — brands can pay to feature their products as "budget alternative" (clearly labeled as sponsored)
- **Premium user tier** — unlimited saves, early trending alerts, advanced search filters ($3.99/mo)

---

## 7. Architecture

### 7.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Mobile App | React Native (Expo) | Single codebase for iOS + Android, fast iteration |
| Web | Next.js 14 (App Router) | SSR for SEO, fast link previews |
| Backend API | Node.js + Fastify | High throughput, lightweight |
| Database | PostgreSQL (primary) | Relational data, strong consistency |
| Media Storage | Cloudflare R2 | Cheap, fast CDN for videos/images |
| Video Processing | FFmpeg via worker queue | Compress/transcode uploaded videos |
| Search | Typesense (self-hosted) | Fast, typo-tolerant, affordable vs Algolia |
| Cache | Redis | Feed caching, rate limiting, session |
| Auth | Supabase Auth | SSO (Google/Apple), email, JWT |
| Queue | BullMQ (Redis-backed) | Background jobs (video processing, notifications) |
| Analytics | PostHog (self-hosted) | Product analytics, funnel tracking |
| Hosting | Railway (app) + Cloudflare (CDN) | Simple deploys, great DX |

### 7.2 System Components

```
┌─────────────────────────────────────────────────────┐
│                   CLIENTS                           │
│  React Native App (iOS/Android)  Next.js Web        │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS / REST + WebSocket
┌─────────────────▼───────────────────────────────────┐
│               API GATEWAY (Fastify)                 │
│  Auth middleware │ Rate limiting │ Route handlers   │
└────┬────────────┬───────────────┬────────────────────┘
     │            │               │
┌────▼───┐  ┌────▼────┐  ┌───────▼──────┐
│PostGres│  │  Redis  │  │  Typesense   │
│  (DB)  │  │ (Cache) │  │  (Search)    │
└────────┘  └─────────┘  └──────────────┘
     │
┌────▼──────────────────────┐
│     Worker Queue (BullMQ) │
│  - Video transcoding      │
│  - Receipt OCR            │
│  - Notification dispatch  │
│  - Affiliate link wrapping│
└───────────────────────────┘
     │
┌────▼──────────────────────┐
│   Cloudflare R2 (Media)   │
│  Videos, Images, Receipts │
└───────────────────────────┘
```

### 7.3 Data Model (Core Entities)

**users**
```
id, username, email, avatar_url, bio,
verified_buy_count, contributor_tier,
created_at, last_active_at
```

**posts**
```
id, user_id, category_id,
original_product_name, original_brand, original_price,
dupe_product_name, dupe_brand, dupe_price,
affiliate_link, affiliate_platform,
media_urls[] (video or images),
review_text, upvotes, downvotes,
is_verified_buy, receipt_verified_at,
status (active/flagged/removed),
created_at
```

**categories**
```
id, name, slug, icon, post_count, is_active
```

**upvotes**
```
id, user_id, post_id, created_at
```

**flags**
```
id, user_id, post_id, reason, created_at
```

**affiliate_clicks**
```
id, post_id, user_id (nullable), session_id,
affiliate_platform, clicked_at, converted_at (nullable),
commission_amount (nullable)
```

**brand_analytics_clients** *(v2)*
```
id, brand_name, contact_email, tier,
subscription_start, subscription_end, mrr
```

---

## 8. Key User Flows

### Flow 1: New User Discovery
```
App Store search → Install → Onboarding (email/SSO)
→ Pick categories → See populated feed
→ Tap a post → View dupe page → Click "Buy This Dupe"
→ Affiliate redirect → Purchase (revenue event)
```

### Flow 2: Post a Dupe
```
Tap "+" → Choose Video or Photo → Fill form
→ Optional: Upload receipt → Submit
→ Post appears in feed (verified posts rank higher)
→ Community upvotes → Post trends → More affiliate clicks
```

### Flow 3: Search with Intent
```
Open app → Search "Stanley Cup dupe"
→ Filter: Verified Only, Most Upvoted
→ View top dupe post → Click "Buy This Dupe"
→ Affiliate redirect
```

### Flow 4: Brand Analytics (v2)
```
Brand discovers Dupe Hunt via sales team outreach
→ Signs up for brand dashboard
→ Sees sentiment trends, top competing dupes
→ Uses data for product pricing/positioning decisions
→ Monthly recurring payment
```

---

## 9. Growth Strategy

### Phase 1: Seed Content (Pre-Launch, 4 weeks)
- Recruit 50–100 Gen Z "founding members" via TikTok/Discord outreach
- Give them early access to post dupes before public launch
- Build a base of 500+ posts across all 5 categories before launch day

### Phase 2: Launch (Week 1–4)
- Launch on Product Hunt
- Seed TikTok content: "I found an app that only shows verified dupe reviews"
- Target micro-influencers in the deinfluencing niche (10K–100K followers)
- Campus ambassador program at 5 universities

### Phase 3: Viral Loop (Month 2+)
- Every dupe post generates a shareable link with rich preview
- "Share to TikTok" one-tap integration on every post
- Weekly "Dupe of the Week" featured post (social media cross-post)
- Push notifications: "Your dupe post just hit 100 upvotes 🔥"

### Phase 4: SEO Compounding (Month 3+)
- Every dupe page = a new SEO-indexed URL
- Target: "best dupe for [product name]" long-tail keywords
- 10,000 posts = 10,000 indexed pages = compounding organic traffic

---

## 10. Success Metrics (KPIs)

### Engagement
- DAU / MAU ratio (target: >40% = healthy community)
- Posts per day (target: 100+ by end of month 1)
- Average session length (target: 4+ minutes)
- Upvotes per post (target: avg 10+ by month 2)

### Growth
- Weekly new user installs
- D1 / D7 / D30 retention (target: 40% / 20% / 10%)
- Viral coefficient (shares per post)

### Revenue
- Affiliate click-through rate (target: >8% of feed views)
- Affiliate conversion rate (target: >3% of clicks)
- Monthly affiliate revenue
- Brand analytics MRR (v2 target: $10K MRR at 6 months)

### Trust & Quality
- % of posts with Verified Buy badge (target: >30% by month 3)
- Flag rate per post (target: <2%)
- Average upvote ratio of posts (target: >75%)

---

## 11. MVP Scope (v1 vs v2 vs v3)

### v1 — Launch (Month 0–3)
- ✅ Mobile app (iOS + Android via React Native/Expo)
- ✅ Email + Google/Apple SSO
- ✅ Feed: For You / Trending / New tabs
- ✅ 5 launch categories
- ✅ Post: video or photo format
- ✅ Verified Buy badge (receipt upload)
- ✅ Upvote / Downvote
- ✅ Search with filters
- ✅ Dupe Page (original vs dupe side-by-side)
- ✅ Affiliate link wrapping + click tracking
- ✅ User profile + saved collections
- ✅ Basic moderation (flags, auto-filter)
- ✅ Web (Next.js) — browse + SEO only, no posting

### v2 — Growth (Month 3–6)
- 🔄 Brand analytics dashboard (B2B SaaS)
- 🔄 Creator revenue share (affiliate split for Top Contributors)
- 🔄 Expanded categories (community-voted)
- 🔄 Gmail/Apple Mail receipt auto-detection
- 🔄 "Share to TikTok" native integration
- 🔄 Push notification system (trending alerts, upvote milestones)
- 🔄 AI dupe suggestion (when posting, AI suggests known dupes for the original)

### v3 — Monetize (Month 6–12)
- 🔮 Premium user tier ($3.99/mo)
- 🔮 Promoted dupes (brand-sponsored, clearly labeled)
- 🔮 Web posting (not just browse)
- 🔮 API for affiliate platforms (auto-link enrichment)
- 🔮 International expansion (UK, AU, CA)

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cold start (not enough content at launch) | High | Pre-launch founding member program to seed 500+ posts |
| Fake verified reviews | High | OCR receipt verification + community flagging |
| Affiliate link abuse (spam posts) | Medium | 1 affiliate link per post limit, new account caps |
| Competitor copies the model | Medium | Community moat — first-mover in the community-first dupe space |
| App Store rejection (receipt uploads) | Low | Receipts stored encrypted, never public, privacy policy compliant |
| Brand legal pressure (trademark) | Medium | Posts are user opinions (Section 230), no counterfeit goods |

---

## 13. Open Questions (Resolved)

| Question | Decision |
|---|---|
| Platform | Mobile first (React Native) + Web (Next.js) for SEO |
| Categories at launch | Multi-category: Beauty, Fashion, Tech, Home, Food |
| Content format | Flexible: video (60s) or photo (up to 5) |
| Monetization | Affiliate commissions (v1) + Brand analytics (v2) |
| Trust/verification | Tiered: open posting + Verified Buy badge for receipt uploads |
| Feed discovery | Hybrid: category-filtered home feed + persistent search |
| Build approach | Community-first MVP — ship fast, validate community traction |

---

*Spec written by Zenith Agent · 2026-04-02*
