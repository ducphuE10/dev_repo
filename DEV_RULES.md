# DEV_RULES.md — Dupe Hunt Contribution Rules

These rules apply to **all contributors** — human developers and AI coding agents alike.
Read this before touching any code.

---

## 1. Golden Rules

1. **Read before you write.** Always read the relevant file(s) before editing. Never assume structure.
2. **One concern per PR.** Don't mix feature work, refactors, and bug fixes in one commit.
3. **No code without a spec.** Every feature must trace back to `docs/design.md`, `docs/technical.md`, or `docs/plan.md`. If it's not there, discuss it first.
4. **Log your work.** Every meaningful change gets an entry in `.zenith-progress.md`. See the format below.
5. **Don't break the feed.** The home feed is the core product. Any change touching feed ranking, post queries, or category filtering requires explicit testing before merge.
6. **Affiliate links are revenue.** Never skip the affiliate click tracking step. Every "Buy This Dupe" tap must record a row in `affiliate_clicks`.
7. **Receipts are private.** Receipt images live in the private R2 bucket and are NEVER exposed publicly. Do not add any endpoint that returns receipt URLs to end users.

---

## 2. Branching Strategy

```
main                    ← production, always deployable
└── feature/<name>      ← feature work (branch off main)
└── fix/<name>          ← bug fixes
└── chore/<name>        ← non-functional changes (deps, config, docs)
```

- Branch names are lowercase with hyphens: `feature/post-creation`, `fix/feed-cursor-bug`
- PRs require at least one review before merging to `main`
- Squash merge into `main` (clean history)

---

## 3. Commit Message Format

Follow Conventional Commits:

```
<type>(<scope>): <short description>

[optional body]

Co-Authored-By: ...
```

**Types:** `feat` · `fix` · `chore` · `refactor` · `test` · `docs` · `perf`

**Scopes:** `api` · `mobile` · `web` · `db` · `worker` · `auth` · `feed` · `search` · `affiliate`

**Examples:**
```
feat(api): add upvote endpoint with optimistic counter update
fix(feed): correct cursor pagination for verified-only filter
chore(db): add index on posts.upvote_count
docs: update technical.md with receipt OCR flow
```

---

## 4. Code Style

### TypeScript
- Strict mode enabled across all apps (`"strict": true` in tsconfig)
- No `any` types — use `unknown` + narrowing if needed
- Prefer `interface` over `type` for object shapes; `type` for unions/aliases
- All async functions must handle errors explicitly (try/catch or Result type)

### API (Fastify)
- Every route must have a Zod schema for request validation
- Return consistent error shapes: `{ error: { code: string, message: string } }`
- Use 400 for validation errors, 401 for auth, 403 for forbidden, 404 for not found, 500 for server errors
- Never return raw database errors to the client

### Mobile (React Native)
- One screen per file in `screens/`
- Shared UI components live in `components/`
- Business logic lives in `hooks/` (custom hooks only — no logic in screen files)
- Use React Query for all API calls — no raw `fetch` in components
- Optimistic UI required for upvote/save/follow actions

### Database
- All migrations are sequential numbered files: `001_`, `002_`, etc.
- Always use `IF NOT EXISTS` for table and index creation
- Never drop columns in a migration — mark as deprecated first, remove in a later migration
- Aggregation counts (`upvote_count`, `flag_count`, etc.) are updated via background worker jobs, not inline SQL in request handlers

### Naming Conventions
| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `post-card.tsx`, `feed-screen.tsx` |
| Components | PascalCase | `PostCard`, `FeedScreen` |
| Hooks | camelCase with `use` prefix | `useFeed`, `useUpvote` |
| API routes | kebab-case | `/affiliate/go/:postId` |
| DB tables | snake_case | `affiliate_clicks`, `user_categories` |
| DB columns | snake_case | `upvote_count`, `created_at` |
| Env vars | SCREAMING_SNAKE_CASE | `CLOUDFLARE_R2_BUCKET` |

---

## 5. Architecture Rules

### Monorepo
- `apps/` — deployable applications only
- `packages/` — shared code consumed by apps
- Never import directly between apps (e.g., `mobile` must not import from `web`)
- Shared types always live in `packages/types`
- Shared DB schema always lives in `packages/db`

### API
- All DB queries go through Drizzle ORM — no raw SQL in route handlers (except complex aggregations)
- Redis cache keys follow the pattern: `{resource}:{id}:{variant}` e.g., `feed:trending:24h`
- Background jobs (BullMQ) handle: video processing, receipt OCR, affiliate link wrapping, counter updates
- Never do heavy work synchronously in a request handler — offload to a worker job

### Mobile
- Navigation is defined centrally in `apps/mobile/src/navigation/`
- No navigation calls inside business logic hooks — only in screen components
- SecureStore for auth tokens only — AsyncStorage for everything else
- All media uploads go directly to Cloudflare R2 via presigned URL — never through the API server

### Web (Next.js)
- All data fetching is server-side (RSC / `fetch` in Server Components) for SEO pages
- Client components only where interactivity is required (upvote button, search input)
- Every public page must have `generateMetadata()` for SEO
- Web is browse-only in v1 — no post creation on web

---

## 6. Testing Rules

- Every new API endpoint needs an integration test
- Every new React component needs a Storybook story (once Storybook is set up in Phase 9)
- Feed ranking logic must have unit tests — it's core to the product
- Affiliate redirect endpoint must be tested end-to-end (click → redirect → DB row)
- Receipt OCR worker must be tested with fixture receipt images (pass + fail cases)

Run tests before pushing:
```bash
pnpm test              # all tests
pnpm test --filter=api # api only
```

---

## 7. Security Rules

- Never commit `.env` files — use `.env.example` with placeholder values
- Never log JWTs, passwords, or receipt URLs
- Receipt images are stored in a **private** R2 bucket — double-check bucket ACL before deploying
- Affiliate links are validated before wrapping — reject non-HTTP(S) URLs
- Rate limiting is enforced on all public endpoints via Redis middleware
- New user accounts (< 7 days old) are capped at 2 posts/day

---

## 8. Progress Report Format

**APPEND to `.zenith-progress.md`** after every meaningful implementation session. Never replace — always append.

```
## [YYYY-MM-DD HH:MM] - [Phase X / Story / Task Name]

### What was implemented
- Short bullet list of what was built

### Files changed
- `path/to/file.ts` — what changed
- `path/to/other.ts` — what changed

### Learnings for future iterations
- Patterns discovered (e.g., "this codebase uses X for Y")
- Gotchas encountered (e.g., "don't forget to update Z when changing W")
- Useful context (e.g., "the feed ranking logic lives in src/lib/ranking.ts")

---
```

The **Learnings** section is critical — it helps future contributors (human or AI) avoid repeating mistakes and understand the codebase faster.

### Consolidating Reusable Patterns

If you discover a pattern that all future contributors should know, add it to the `## Codebase Patterns` section at the **TOP** of `.zenith-progress.md`. Create the section if it doesn't exist yet.

```
## Codebase Patterns
- Use `sql<number>` template for numeric aggregations in Drizzle
- Always use `IF NOT EXISTS` for migrations
- Feed queries must always filter `status = 'active'` — never return flagged/removed posts
- Affiliate click tracking happens in the redirect endpoint, not the frontend
```

Only add patterns that are **general and reusable** — not story-specific details.

---

## 9. Definition of Ready (Before Starting a Task)

Before picking up a task from `docs/plan.md`:
- [ ] The phase above it is complete (or the task has no dependencies)
- [ ] You've read the relevant section of `docs/technical.md`
- [ ] You know which files will be touched
- [ ] The task is specific enough to complete in one session

## 10. Definition of Done (Before Marking a Task Complete)

Before checking off a task in `docs/plan.md`:
- [ ] Code is written and working locally
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Relevant tests pass (`pnpm test`)
- [ ] `.zenith-progress.md` has been updated
- [ ] Changes are committed with a proper commit message
