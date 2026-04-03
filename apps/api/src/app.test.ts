import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseClient } from "@dupe-hunt/db";

import { signAccessToken, type AuthProvider, type AuthSession } from "./auth.ts";
import { ApiError, buildApiServer, type BackgroundJobQueue, type RedisClient } from "./app.ts";
import { loadApiConfig, type ApiConfig } from "./config.ts";
import {
  type ApiRepository,
  type CategoryRecord,
  type CreatePostInput,
  type CreateUserInput,
  type FeedTab,
  type PostRecord,
  type UpdateUserProfileInput,
  type UserRecord
} from "./repository.ts";

const createTestConfig = (): ApiConfig => ({
  databaseUrl: "postgresql://postgres:postgres@localhost:5432/dupe_hunt",
  redisUrl: "redis://localhost:6379",
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "service-key",
  jwtSecret: "jwt-secret",
  cloudflareR2AccountId: "account-id",
  cloudflareR2AccessKey: "access-key",
  cloudflareR2SecretKey: "secret-key",
  cloudflareR2Bucket: "dupe-hunt-media",
  typesenseHost: "http://localhost:8108",
  typesenseApiKey: "typesense-key",
  affiliateWrappingDomain: "https://go.dupehunt.com",
  ocrServiceKey: "ocr-key",
  port: 3001,
  nodeEnv: "test"
});

const createDatabaseDouble = (): DatabaseClient =>
  ({
    db: {} as DatabaseClient["db"],
    sql: {} as DatabaseClient["sql"],
    close: async () => undefined
  }) satisfies DatabaseClient;

const createRedisDouble = (): RedisClient => ({
  url: "redis://localhost:6379",
  ping: async () => "PONG",
  close: async () => undefined
});

const now = "2026-04-03T12:00:00.000Z";

const createUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  id: "11111111-1111-4111-8111-111111111111",
  username: "zoe_dupes",
  email: "zoe@example.com",
  avatarUrl: null,
  bio: null,
  verifiedBuyCount: 0,
  totalUpvotes: 0,
  contributorTier: "standard",
  postsPerDayCount: 0,
  lastPostDate: null,
  createdAt: now,
  lastActiveAt: now,
  ...overrides
});

const createCategoryRecord = (overrides: Partial<CategoryRecord> = {}): CategoryRecord => ({
  id: 1,
  name: "Beauty & Skincare",
  slug: "beauty",
  icon: "💄",
  postCount: 0,
  sortOrder: 1,
  isActive: true,
  ...overrides
});

const createPostRecord = (overrides: Partial<PostRecord> = {}): PostRecord => {
  const user = overrides.user ?? createUserRecord();
  const category = overrides.category ?? createCategoryRecord();
  const originalPrice = overrides.originalPrice ?? 49;
  const dupePrice = overrides.dupePrice ?? 14;

  return {
    id: overrides.id ?? "44444444-4444-4444-8444-000000000001",
    userId: overrides.userId ?? user.id,
    categoryId: overrides.categoryId ?? category.id,
    originalProductName: overrides.originalProductName ?? "Charlotte Tilbury Flawless Filter",
    originalBrand: overrides.originalBrand ?? "Charlotte Tilbury",
    originalPrice,
    originalCurrency: overrides.originalCurrency ?? "USD",
    dupeProductName: overrides.dupeProductName ?? "e.l.f. Halo Glow Liquid Filter",
    dupeBrand: overrides.dupeBrand ?? "e.l.f.",
    dupePrice,
    dupeCurrency: overrides.dupeCurrency ?? "USD",
    priceSaved: overrides.priceSaved ?? Number((originalPrice - dupePrice).toFixed(2)),
    mediaType: overrides.mediaType ?? "photo",
    mediaUrls: overrides.mediaUrls ?? ["https://dupe-hunt-media.r2.dev/posts/sample.jpg"],
    reviewText: overrides.reviewText ?? "Literally identical finish.",
    affiliateLink: overrides.affiliateLink ?? null,
    affiliatePlatform: overrides.affiliatePlatform ?? null,
    upvoteCount: overrides.upvoteCount ?? 0,
    downvoteCount: overrides.downvoteCount ?? 0,
    flagCount: overrides.flagCount ?? 0,
    isVerifiedBuy: overrides.isVerifiedBuy ?? false,
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    user,
    category
  };
};

const scoreForYouPost = (post: PostRecord) =>
  post.upvoteCount + (post.isVerifiedBuy ? 10 : 0) + (Date.parse(post.createdAt) >= Date.parse(now) - 86_400_000 ? 5 : 0);

const sortPosts = (posts: PostRecord[], tab: FeedTab) =>
  [...posts].sort((left, right) => {
    if (tab === "for_you") {
      const scoreDelta = scoreForYouPost(right) - scoreForYouPost(left);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }
    }

    if (tab === "trending" && left.upvoteCount !== right.upvoteCount) {
      return right.upvoteCount - left.upvoteCount;
    }

    const createdAtDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return right.id.localeCompare(left.id);
  });

const createRepositoryDouble = () => {
  const users = new Map<string, UserRecord>();
  const categories = [
    createCategoryRecord(),
    createCategoryRecord({
      id: 2,
      name: "Tech Accessories",
      slug: "tech",
      icon: "💻",
      sortOrder: 2
    }),
    createCategoryRecord({
      id: 3,
      name: "Home & Decor",
      slug: "home",
      icon: "🏠",
      sortOrder: 3,
      isActive: false
    })
  ];
  const userCategorySelections = new Map<string, number[]>();
  const posts = new Map<string, PostRecord>();
  let postCounter = 2;

  const repository: ApiRepository = {
    findUserByEmail: async (email) =>
      Array.from(users.values()).find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null,
    findUserById: async (id) => users.get(id) ?? null,
    findUserByUsername: async (username) =>
      Array.from(users.values()).find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null,
    createUser: async (input: CreateUserInput) => {
      const user = createUserRecord({
        id: input.id,
        username: input.username,
        email: input.email
      });

      users.set(user.id, user);

      return user;
    },
    updateUserProfile: async (userId: string, input: UpdateUserProfileInput) => {
      const existing = users.get(userId);

      if (!existing) {
        return null;
      }

      const updated: UserRecord = {
        ...existing,
        username: input.username ?? existing.username,
        bio: input.bio ?? existing.bio,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        lastActiveAt: now
      };

      users.set(userId, updated);

      return updated;
    },
    touchUser: async (userId: string) => {
      const existing = users.get(userId);

      if (existing) {
        users.set(userId, {
          ...existing,
          lastActiveAt: now
        });
      }
    },
    listActiveCategories: async () =>
      categories.filter((category) => category.isActive).sort((left, right) => left.sortOrder - right.sortOrder),
    listUserCategories: async (userId) =>
      (userCategorySelections.get(userId) ?? [])
        .map((id) => categories.find((category) => category.id === id && category.isActive))
        .filter((category): category is CategoryRecord => Boolean(category)),
    replaceUserCategories: async (userId, categoryIds) => {
      userCategorySelections.set(userId, [...categoryIds]);
      return repository.listUserCategories(userId);
    },
    createPost: async (input: CreatePostInput) => {
      const user = users.get(input.userId);
      const category = categories.find((entry) => entry.id === input.categoryId);

      assert.ok(user, "expected createPost user to exist");
      assert.ok(category, "expected createPost category to exist");

      const id = `44444444-4444-4444-8444-${String(postCounter).padStart(12, "0")}`;
      postCounter += 1;

      const post = createPostRecord({
        id,
        userId: input.userId,
        categoryId: input.categoryId,
        originalProductName: input.originalProductName,
        originalBrand: input.originalBrand ?? null,
        originalPrice: input.originalPrice,
        originalCurrency: input.originalCurrency,
        dupeProductName: input.dupeProductName,
        dupeBrand: input.dupeBrand ?? null,
        dupePrice: input.dupePrice,
        dupeCurrency: input.dupeCurrency,
        mediaType: input.mediaType,
        mediaUrls: input.mediaUrls,
        reviewText: input.reviewText ?? null,
        affiliateLink: input.affiliateLink ?? null,
        affiliatePlatform: input.affiliatePlatform ?? null,
        createdAt: now,
        updatedAt: now,
        user,
        category
      });

      posts.set(post.id, post);
      users.set(user.id, {
        ...user,
        postsPerDayCount: user.postsPerDayCount + 1,
        lastPostDate: "2026-04-03",
        lastActiveAt: now
      });
      category.postCount += 1;

      return post;
    },
    findPostById: async (postId, options = {}) => {
      const post = posts.get(postId) ?? null;

      if (!post) {
        return null;
      }

      if (!options.includeInactive && (post.status !== "active" || !post.category.isActive)) {
        return null;
      }

      return post;
    },
    listPosts: async (input) => {
      const categoryIds = input.categoryIds ? new Set(input.categoryIds) : null;
      const filtered = Array.from(posts.values()).filter((post) => {
        if (post.status !== "active" || !post.category.isActive) {
          return false;
        }

        if (input.tab === "trending" && Date.parse(post.createdAt) < Date.parse(now) - 86_400_000) {
          return false;
        }

        if (input.verifiedOnly && !post.isVerifiedBuy) {
          return false;
        }

        if (categoryIds && !categoryIds.has(post.categoryId)) {
          return false;
        }

        return true;
      });
      const sorted = sortPosts(filtered, input.tab);

      if (!input.cursor) {
        return sorted.slice(0, input.limit);
      }

      const cursorIndex = sorted.findIndex((post) => post.id === input.cursor);

      return cursorIndex === -1 ? [] : sorted.slice(cursorIndex + 1, cursorIndex + 1 + input.limit);
    },
    softDeletePost: async (postId) => {
      const existing = posts.get(postId);

      if (!existing || existing.status === "removed") {
        return;
      }

      posts.set(postId, {
        ...existing,
        status: "removed",
        updatedAt: now
      });
      existing.category.postCount = Math.max(existing.category.postCount - 1, 0);
    }
  };

  return {
    repository,
    users,
    categories,
    posts,
    userCategorySelections
  };
};

const createJobQueueDouble = () => {
  const jobs: Array<{ name: string; payload: Record<string, unknown> }> = [];

  const queue: BackgroundJobQueue = {
    enqueue: async (name, payload) => {
      jobs.push({
        name,
        payload
      });
    },
    close: async () => undefined
  };

  return {
    jobs,
    queue
  };
};

const createAuthProviderDouble = (config: ApiConfig) => {
  const sessions = new Map<string, AuthSession>();

  const createSession = (
    userId: string,
    email: string,
    provider: AuthSession["provider"],
    refreshToken = `${provider}-refresh-${userId}`
  ) => {
    const session: AuthSession = {
      userId,
      email,
      accessToken: signAccessToken(
        {
          sub: userId,
          email
        },
        config.jwtSecret
      ),
      refreshToken,
      provider
    };

    sessions.set(refreshToken, session);

    return session;
  };

  const authProvider: AuthProvider = {
    register: async ({ email, password }) => {
      if (password === "bad-pass") {
        throw Object.assign(new Error("Password rejected."), {
          statusCode: 400,
          code: "AUTH_REQUEST_FAILED"
        });
      }

      return createSession("11111111-1111-4111-8111-111111111111", email, "password", "register-refresh");
    },
    login: async ({ email, password }) => {
      if (password === "wrong-pass") {
        throw Object.assign(new Error("Invalid login credentials."), {
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS"
        });
      }

      return createSession("11111111-1111-4111-8111-111111111111", email, "password", "login-refresh");
    },
    logout: async ({ refreshToken }) => {
      if (!sessions.has(refreshToken)) {
        throw Object.assign(new Error("Refresh token not found."), {
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS"
        });
      }

      sessions.delete(refreshToken);
    },
    refresh: async ({ refreshToken }) => {
      const existing = sessions.get(refreshToken);

      if (!existing) {
        throw Object.assign(new Error("Refresh token not found."), {
          statusCode: 401,
          code: "AUTH_INVALID_CREDENTIALS"
        });
      }

      return createSession(existing.userId, existing.email, existing.provider, "refreshed-token");
    },
    exchangeOAuth: async ({ provider, token }) => {
      if (!token) {
        throw Object.assign(new Error("Missing token."), {
          statusCode: 400,
          code: "VALIDATION_ERROR"
        });
      }

      return createSession(
        "22222222-2222-4222-8222-222222222222",
        provider === "google" ? "google_user@example.com" : "apple_user@example.com",
        provider,
        `${provider}-oauth-refresh`
      );
    }
  };

  return {
    authProvider,
    createSession
  };
};

const createTestServer = () => {
  const config = createTestConfig();
  const { repository, users, categories, posts, userCategorySelections } = createRepositoryDouble();
  const { authProvider, createSession } = createAuthProviderDouble(config);
  const { jobs, queue } = createJobQueueDouble();
  const app = buildApiServer({
    config,
    database: createDatabaseDouble(),
    redis: createRedisDouble(),
    repository,
    authProvider,
    jobs: queue
  });

  return {
    app,
    categories,
    config,
    jobs,
    posts,
    users,
    userCategorySelections,
    createSession
  };
};

test("loadApiConfig parses the shared API contract into runtime config", () => {
  const config = loadApiConfig({
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/dupe_hunt",
    REDIS_URL: "redis://localhost:6379",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_KEY: "service-key",
    JWT_SECRET: "jwt-secret",
    CLOUDFLARE_R2_ACCOUNT_ID: "account-id",
    CLOUDFLARE_R2_ACCESS_KEY: "access-key",
    CLOUDFLARE_R2_SECRET_KEY: "secret-key",
    CLOUDFLARE_R2_BUCKET: "dupe-hunt-media",
    TYPESENSE_HOST: "http://localhost:8108",
    TYPESENSE_API_KEY: "typesense-key",
    AFFILIATE_WRAPPING_DOMAIN: "https://go.dupehunt.com",
    OCR_SERVICE_KEY: "ocr-key",
    PORT: "3001",
    NODE_ENV: "test"
  });

  assert.equal(config.port, 3001);
  assert.equal(config.nodeEnv, "test");
  assert.equal(config.typesenseHost, "http://localhost:8108");
});

test("GET /health returns the Fastify scaffold status without live infra", async (context) => {
  const { app } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/health"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    service: "@dupe-hunt/api",
    environment: "test",
    dependencies: {
      database: "configured",
      redis: "configured"
    }
  });
});

test("auth registration returns JWT and creates the app profile", async (context) => {
  const { app, users } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      username: "zoe_dupes",
      email: "zoe@example.com",
      password: "super-safe-password"
    }
  });

  assert.equal(response.statusCode, 201);
  const payload = response.json();

  assert.equal(payload.user.username, "zoe_dupes");
  assert.equal(typeof payload.token, "string");
  assert.equal(payload.refresh_token, "register-refresh");
  assert.equal(users.size, 1);
});

test("auth login rejects bad credentials with the shared error shape", async (context) => {
  const { app } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "zoe@example.com",
      password: "wrong-pass"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: {
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid login credentials."
    }
  });
});

test("auth refresh exchanges a refresh token for a new session", async (context) => {
  const { app } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    payload: {
      refresh_token: "login-refresh"
    }
  });

  assert.equal(response.statusCode, 401);

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "zoe@example.com",
      password: "super-safe-password"
    }
  });

  assert.equal(loginResponse.statusCode, 200);

  const refreshResponse = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    payload: {
      refresh_token: "login-refresh"
    }
  });

  assert.equal(refreshResponse.statusCode, 200);
  assert.equal(refreshResponse.json().refresh_token, "refreshed-token");
});

test("oauth callback provisions a profile when the Supabase identity is new", async (context) => {
  const { app, users } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/auth/oauth/google",
    payload: {
      token: "mock-google-token"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().refresh_token, "google-oauth-refresh");
  assert.equal(users.has("22222222-2222-4222-8222-222222222222"), true);
});

test("GET /categories returns only active categories in sort order", async (context) => {
  const { app } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/categories"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    categories: [
      {
        id: 1,
        name: "Beauty & Skincare",
        slug: "beauty",
        icon: "💄",
        post_count: 0,
        sort_order: 1
      },
      {
        id: 2,
        name: "Tech Accessories",
        slug: "tech",
        icon: "💻",
        post_count: 0,
        sort_order: 2
      }
    ]
  });
});

test("authenticated user routes return and update the current profile", async (context) => {
  const { app, users, createSession } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);
  const session = createSession(existingUser.id, existingUser.email, "password", "existing-refresh");

  context.after(async () => {
    await app.close();
  });

  const meResponse = await app.inject({
    method: "GET",
    url: "/users/me",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  assert.equal(meResponse.statusCode, 200);
  assert.equal(meResponse.json().user.email, existingUser.email);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: "/users/me",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    payload: {
      username: "zoe_reviews",
      bio: "Affordable finds only.",
      avatar_url: "https://cdn.example.com/avatar.jpg"
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.json().user, {
    id: existingUser.id,
    username: "zoe_reviews",
    avatar_url: "https://cdn.example.com/avatar.jpg",
    bio: "Affordable finds only.",
    verified_buy_count: 0,
    total_upvotes: 0,
    contributor_tier: "standard",
    created_at: now,
    last_active_at: now,
    email: "zoe@example.com",
    posts_per_day_count: 0,
    last_post_date: null
  });
});

test("public user lookup validates UUIDs and returns public profile data", async (context) => {
  const { app, users } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);

  context.after(async () => {
    await app.close();
  });

  const badResponse = await app.inject({
    method: "GET",
    url: "/users/not-a-uuid"
  });

  assert.equal(badResponse.statusCode, 400);

  const goodResponse = await app.inject({
    method: "GET",
    url: `/users/${existingUser.id}`
  });

  assert.equal(goodResponse.statusCode, 200);
  assert.equal(goodResponse.json().user.email, undefined);
  assert.equal(goodResponse.json().user.username, existingUser.username);
});

test("user category preferences can be listed and replaced", async (context) => {
  const { app, users, userCategorySelections, createSession } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);
  userCategorySelections.set(existingUser.id, [1]);
  const session = createSession(existingUser.id, existingUser.email, "password", "category-refresh");

  context.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/users/me/categories",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().categories.length, 1);

  const invalidResponse = await app.inject({
    method: "PUT",
    url: "/users/me/categories",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    payload: {
      category_ids: [3]
    }
  });

  assert.equal(invalidResponse.statusCode, 400);

  const updateResponse = await app.inject({
    method: "PUT",
    url: "/users/me/categories",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    payload: {
      category_ids: [2, 1, 2]
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.json(), {
    categories: [
      {
        id: 2,
        name: "Tech Accessories",
        slug: "tech",
        icon: "💻",
        post_count: 0,
        sort_order: 2
      },
      {
        id: 1,
        name: "Beauty & Skincare",
        slug: "beauty",
        icon: "💄",
        post_count: 0,
        sort_order: 1
      }
    ]
  });
});

test("POST /upload/media signs a media upload target for authenticated users", async (context) => {
  const { app, users, createSession } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);
  const session = createSession(existingUser.id, existingUser.email, "password", "upload-refresh");

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/upload/media",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    payload: {
      media_type: "photo",
      content_type: "image/jpeg",
      file_name: "halo-glow.jpg"
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();

  assert.equal(payload.expires_in, 300);
  assert.match(payload.upload_url, /^https:\/\/account-id\.r2\.cloudflarestorage\.com\/dupe-hunt-media\/posts\//);
  assert.match(payload.upload_url, /signature=/);
  assert.match(payload.media_url, /^https:\/\/dupe-hunt-media\.r2\.dev\/posts\/.*\.jpg$/);
});

test("POST /posts creates a post and enqueues video and affiliate jobs when needed", async (context) => {
  const { app, categories, jobs, users, createSession } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);
  const session = createSession(existingUser.id, existingUser.email, "password", "post-refresh");

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/posts",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    },
    payload: {
      category_id: categories[0]?.id,
      original_product_name: "Dyson Airwrap",
      original_brand: "Dyson",
      original_price: 599,
      dupe_product_name: "Shark FlexStyle",
      dupe_brand: "Shark",
      dupe_price: 279,
      media_type: "video",
      media_urls: ["https://dupe-hunt-media.r2.dev/posts/video.mp4"],
      review_text: "Same bounce, way lower price.",
      affiliate_link: "https://www.amazon.com/example-dupe"
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().post.price_saved, 320);
  assert.equal(response.json().post.media_type, "video");
  assert.deepEqual(
    jobs.map((job) => job.name),
    ["process-video", "wrap-affiliate-link"]
  );
  assert.equal(jobs[1]?.payload.affiliatePlatform, "amazon");
});

test("GET /posts applies for-you ranking, category preferences, and cursor pagination", async (context) => {
  const { app, categories, posts, users, userCategorySelections, createSession } = createTestServer();
  const existingUser = createUserRecord();
  users.set(existingUser.id, existingUser);
  userCategorySelections.set(existingUser.id, [1]);
  const session = createSession(existingUser.id, existingUser.email, "password", "feed-refresh");
  const beautyCategory = categories[0]!;
  const techCategory = categories[1]!;
  const topBeautyPost = createPostRecord({
    id: "44444444-4444-4444-8444-000000000101",
    category: beautyCategory,
    categoryId: beautyCategory.id,
    user: existingUser,
    userId: existingUser.id,
    upvoteCount: 1,
    isVerifiedBuy: true,
    createdAt: now
  });
  const secondBeautyPost = createPostRecord({
    id: "44444444-4444-4444-8444-000000000102",
    category: beautyCategory,
    categoryId: beautyCategory.id,
    user: existingUser,
    userId: existingUser.id,
    upvoteCount: 9,
    isVerifiedBuy: false,
    createdAt: "2026-04-03T11:00:00.000Z"
  });
  const filteredOutTechPost = createPostRecord({
    id: "44444444-4444-4444-8444-000000000103",
    category: techCategory,
    categoryId: techCategory.id,
    user: existingUser,
    userId: existingUser.id,
    upvoteCount: 20,
    isVerifiedBuy: true,
    createdAt: now
  });
  posts.set(topBeautyPost.id, topBeautyPost);
  posts.set(secondBeautyPost.id, secondBeautyPost);
  posts.set(filteredOutTechPost.id, filteredOutTechPost);

  context.after(async () => {
    await app.close();
  });

  const firstPage = await app.inject({
    method: "GET",
    url: "/posts?limit=1",
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  assert.equal(firstPage.statusCode, 200);
  assert.equal(firstPage.json().posts[0]?.id, topBeautyPost.id);
  assert.equal(firstPage.json().next_cursor, topBeautyPost.id);

  const secondPage = await app.inject({
    method: "GET",
    url: `/posts?limit=1&cursor=${topBeautyPost.id}`,
    headers: {
      authorization: `Bearer ${session.accessToken}`
    }
  });

  assert.equal(secondPage.statusCode, 200);
  assert.equal(secondPage.json().posts[0]?.id, secondBeautyPost.id);
  assert.equal(secondPage.json().next_cursor, null);

  const badCursorResponse = await app.inject({
    method: "GET",
    url: "/posts?cursor=44444444-4444-4444-8444-999999999999"
  });

  assert.equal(badCursorResponse.statusCode, 400);
});

test("GET /posts supports anonymous trending queries with verified and category filters", async (context) => {
  const { app, categories, posts, users } = createTestServer();
  const author = createUserRecord();
  users.set(author.id, author);
  posts.set(
    "44444444-4444-4444-8444-000000000301",
    createPostRecord({
      id: "44444444-4444-4444-8444-000000000301",
      user: author,
      userId: author.id,
      category: categories[0]!,
      categoryId: categories[0]!.id,
      upvoteCount: 7,
      isVerifiedBuy: true,
      createdAt: now
    })
  );
  posts.set(
    "44444444-4444-4444-8444-000000000302",
    createPostRecord({
      id: "44444444-4444-4444-8444-000000000302",
      user: author,
      userId: author.id,
      category: categories[0]!,
      categoryId: categories[0]!.id,
      upvoteCount: 12,
      isVerifiedBuy: false,
      createdAt: now
    })
  );
  posts.set(
    "44444444-4444-4444-8444-000000000303",
    createPostRecord({
      id: "44444444-4444-4444-8444-000000000303",
      user: author,
      userId: author.id,
      category: categories[1]!,
      categoryId: categories[1]!.id,
      upvoteCount: 50,
      isVerifiedBuy: true,
      createdAt: now
    })
  );
  posts.set(
    "44444444-4444-4444-8444-000000000304",
    createPostRecord({
      id: "44444444-4444-4444-8444-000000000304",
      user: author,
      userId: author.id,
      category: categories[0]!,
      categoryId: categories[0]!.id,
      upvoteCount: 100,
      isVerifiedBuy: true,
      createdAt: "2026-04-01T12:00:00.000Z"
    })
  );

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/posts?tab=trending&verified=true&category=beauty"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json().posts.map((post: { id: string }) => post.id),
    ["44444444-4444-4444-8444-000000000301"]
  );
});

test("GET /posts/:id returns active posts and DELETE /posts/:id is owner-only soft delete", async (context) => {
  const { app, categories, posts, users, createSession } = createTestServer();
  const owner = createUserRecord();
  const otherUser = createUserRecord({
    id: "33333333-3333-4333-8333-333333333333",
    username: "other_user",
    email: "other@example.com"
  });
  users.set(owner.id, owner);
  users.set(otherUser.id, otherUser);
  const post = createPostRecord({
    id: "44444444-4444-4444-8444-000000000201",
    user: owner,
    userId: owner.id,
    category: categories[0]!,
    categoryId: categories[0]!.id
  });
  posts.set(post.id, post);
  const ownerSession = createSession(owner.id, owner.email, "password", "owner-refresh");
  const otherSession = createSession(otherUser.id, otherUser.email, "password", "other-refresh");

  context.after(async () => {
    await app.close();
  });

  const showResponse = await app.inject({
    method: "GET",
    url: `/posts/${post.id}`
  });

  assert.equal(showResponse.statusCode, 200);
  assert.equal(showResponse.json().post.id, post.id);

  const forbiddenDelete = await app.inject({
    method: "DELETE",
    url: `/posts/${post.id}`,
    headers: {
      authorization: `Bearer ${otherSession.accessToken}`
    }
  });

  assert.equal(forbiddenDelete.statusCode, 403);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/posts/${post.id}`,
    headers: {
      authorization: `Bearer ${ownerSession.accessToken}`
    }
  });

  assert.equal(deleteResponse.statusCode, 204);

  const notFoundResponse = await app.inject({
    method: "GET",
    url: `/posts/${post.id}`
  });

  assert.equal(notFoundResponse.statusCode, 404);
});

test("unknown routes use the shared error payload shape", async (context) => {
  const { app } = createTestServer();

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/missing"
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      code: "NOT_FOUND",
      message: "Route GET:/missing not found"
    }
  });
});

test("application errors flow through the consistent error handler", async (context) => {
  const { app } = createTestServer();

  app.get("/boom", async () => {
    throw new ApiError(503, "DEPENDENCY_UNAVAILABLE", "Redis is unavailable.");
  });

  context.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/boom"
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    error: {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Redis is unavailable."
    }
  });
});
