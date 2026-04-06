# Beta Release Guide

This document is the repo-level checklist for shipping the Dupe Hunt beta. It uses the current monorepo reality, not the aspirational roadmap.

## Release scope

The current beta covers:

- `apps/api`: Fastify API with auth, feed, post creation, social, search, affiliate redirect tracking, moderation endpoints, and receipt verification submission/resolution.
- `apps/web`: browse-only Next.js web layer for SEO, social sharing, and affiliate redirect handoff.
- `apps/mobile`: Expo mobile client for auth, onboarding, feed browsing, post creation, profile/social flows, and receipt verification submission.

## CI quality gate

Every pull request and every push to `main` must pass `.github/workflows/ci.yml`, which runs the workspace quality contract exactly as documented in `.zenith-plan.json`:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Do not bypass these commands with app-local substitutes when deciding release readiness.

## Environment and secret checklist

Required before any beta deploy:

- API secrets: `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `ADMIN_API_KEY`, `OCR_SERVICE_KEY`
- Storage: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`
- Web/mobile public endpoints: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Affiliate/search support: `AFFILIATE_WRAPPING_DOMAIN`, `TYPESENSE_HOST`, `TYPESENSE_API_KEY`

Keep production and beta secrets separate. `ADMIN_API_KEY` must never be reused in mobile or web clients.

## Receipt privacy requirements

Receipt handling is the highest-risk launch surface. The beta must preserve these invariants:

1. Receipt images stay in the private R2 bucket path returned by `POST /upload/receipt`.
2. Clients may receive `upload_url` and `receipt_key`, but never a public receipt URL.
3. `POST /posts/:id/verify` stores only an internal `r2://...` reference on the post and exposes status fields, not the underlying asset location.
4. Logs, screenshots, support tickets, and admin tooling must not include raw receipt images or receipt URLs.
5. OCR access is limited to the verification worker path; receipt objects are not general media assets.

If any environment, dashboard, or debug workflow would expose private receipt media, stop the release and fix that first.

## Deployment order

Deploy in this order so clients always point at a compatible backend:

1. `apps/api`
2. `apps/web`
3. `apps/mobile`

Recommended beta sequence:

1. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally.
2. Apply database migrations with `pnpm db:migrate` against the target API database.
3. Deploy the API and confirm `GET /health` returns `200`.
4. Deploy the web app with production `NEXT_PUBLIC_*` values and verify browse routes render.
5. Build and distribute the Expo beta build after the API and web URLs are stable.

## Launch verification checklist

Verify these flows against the deployed beta before inviting testers:

- Health: `GET /health` returns `200` and reports the expected environment.
- Auth: register or sign in, refresh a session, and fetch `/users/me`.
- Feed and browse: mobile feed tabs load, web home/category/post/user/search pages render without upstream crashes.
- Post creation: create one photo post and confirm it appears in `GET /posts` and on the web detail page.
- Affiliate redirect: trigger `/affiliate/go/:postId`, confirm the redirect works, and confirm the click is visible in admin stats.
- Receipt verification: upload a receipt, submit `/posts/:id/verify`, and confirm the post moves through `pending` to `verified` or `failed` without exposing a receipt URL.
- Moderation: flag a post, verify it appears in `GET /admin/flags`, and confirm admin post-status updates still work.

## Monitoring hooks

The repo does not yet ship a full observability stack, so beta monitoring relies on narrow, explicit hooks:

| Surface | Hook | Expected signal |
| --- | --- | --- |
| API uptime | `GET /health` | `200` plus stable response latency |
| Moderation queue | `GET /admin/flags` with `x-admin-key` | Queue count stays manageable; no stuck flagged items |
| Affiliate flow | `GET /admin/stats` with `x-admin-key` | `affiliate_clicks` increases after manual redirect checks |
| Receipt pipeline | Post detail + verification status fields | `pending` jobs resolve to `verified` or `failed` within an acceptable window |
| CI regression gate | GitHub Actions `CI` workflow | Every merge candidate passes `lint`, `typecheck`, and `test` |

Until Sentry or another observability system is added, release owners should record these checks manually for each beta cut.

## Rollback triggers

Rollback or pause tester invites if any of these occur:

- `pnpm lint`, `pnpm typecheck`, or `pnpm test` fail on the release branch
- `/health` is unstable after API deploy
- Receipt verification leaks a private asset URL or stores receipts outside the private bucket path
- Affiliate redirects fail or stop incrementing admin stats
- Moderation endpoints reject valid admin requests or stop surfacing newly flagged posts

## Beta sign-off record

Record this with each beta release:

- Commit SHA
- CI run URL
- Migration version applied
- Release owner
- Time of API/web/mobile deploys
- Result of each launch verification checklist item
- Any known beta-only issues communicated to testers
