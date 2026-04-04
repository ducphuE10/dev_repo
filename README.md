# Dupe Hunt

> *"Real people. Real dupes. Real savings."*

A community-powered dupe discovery platform built for Gen Z — where real people share verified, honest reviews of affordable alternatives to expensive products across every category.

---

## What Is Dupe Hunt?

Dupe Hunt is a mobile-first B2C app that lets users post and discover product "dupes" (affordable alternatives to expensive branded products). Unlike AI-only tools like Dupe.com or Brandefy, Dupe Hunt is **community-first** — every review comes from a real person who actually bought the product.

**Core differentiators:**
- ✅ Verified Buy badge system (receipt OCR verification)
- 📹 Video or photo reviews — flexible, low-friction posting
- 🗂️ Multi-category: Beauty, Fashion, Tech, Home, Food
- 🚫 Zero paid influencer partnerships — radical honesty is the brand
- 💰 Affiliate revenue from day one; Brand Analytics dashboard in v2

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) — iOS + Android |
| Web | Next.js (App Router) — SEO/browse layer |
| API | Node.js + Fastify |
| Database | PostgreSQL + Drizzle ORM |
| Cache | Redis |
| Search | Typesense |
| Media | Cloudflare R2 |
| Auth | Supabase Auth (Google/Apple/email) |
| Queue | BullMQ |
| Monorepo | Turborepo + pnpm |

---

## Repository Structure

```
dupe-hunt/
├── apps/
│   ├── mobile/        # React Native (Expo)
│   ├── web/           # Next.js App Router
│   └── api/           # Node.js + Fastify
├── packages/
│   ├── db/            # Drizzle ORM schema + migrations
│   ├── types/         # Shared TypeScript types
│   └── config/        # Shared ESLint, TSConfig
├── docs/
│   ├── design.md      # Product design spec
│   ├── technical.md   # API, DB schema, screen map
│   └── plan.md        # Implementation plan (10 phases)
├── DEV_RULES.md       # Contribution rules for humans + agents
├── .zenith-progress.md # Running log of implementation progress
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker (for local PostgreSQL + Redis)
- Expo CLI (`npm install -g expo-cli`)

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/dupe-hunt.git
cd dupe-hunt

# Install dependencies
pnpm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# Start local infrastructure (Postgres + Redis)
docker compose up -d

# Run database migrations
pnpm db:migrate

# Start all apps in dev mode
pnpm dev
```

### Individual apps

```bash
pnpm dev --filter=api       # API on http://localhost:3001
pnpm dev --filter=web       # Web on http://localhost:3000
pnpm dev --filter=mobile    # Expo dev server
```

If `5432` or `6379` is already in use on your machine, override the host bindings for Docker Compose, for example `POSTGRES_PORT=55432 REDIS_PORT=56379 docker compose up -d`, and point `DATABASE_URL` / `REDIS_URL` at those ports in `apps/api/.env`.

---

## Documentation

| Doc | Description |
|---|---|
| [`docs/design.md`](docs/design.md) | Full product design — vision, features, monetization, growth strategy |
| [`docs/technical.md`](docs/technical.md) | Technical spec — DB schema, API endpoints, screen map, flows |
| [`docs/plan.md`](docs/plan.md) | Implementation plan — 10 phases, task checklists, timeline |
| [`DEV_RULES.md`](DEV_RULES.md) | Contribution rules for developers and AI coding agents |
| [`.zenith-progress.md`](.zenith-progress.md) | Running log of what has been built and key learnings |

---

## MVP Scope (v1)

- Mobile app (iOS + Android)
- Auth: email + Google/Apple SSO
- Feed: For You / Trending / New
- 5 launch categories
- Post: video or photo
- Verified Buy badge (receipt upload + OCR)
- Upvote / Downvote / Save / Flag
- Search with filters
- Dupe Page (original vs dupe side-by-side)
- Affiliate link tracking
- User profiles
- Web: browse + SEO only

See [`docs/plan.md`](docs/plan.md) for the full phased build plan.

## Current Status

- Workspace bootstrap, shared config, the database package, the Fastify API, the Expo mobile app, and the browse-only Next.js web layer are implemented.
- `packages/db` owns the Drizzle schema, sequential SQL migrations, and the root `pnpm db:migrate` workflow.
- `apps/api` provides real auth, feed, social, search, affiliate, and admin endpoints with isolated `app.inject()` coverage.
- `apps/mobile` now ships live auth, onboarding, feed, detail, profile, and post-composer flows against the API.
- `apps/web` now serves SSR category, post, user, and search pages plus sitemap and affiliate redirect handling for SEO/share links.

---

## Contributing

Read [`DEV_RULES.md`](DEV_RULES.md) before making any changes. All contributors — human and AI — follow the same rules.
