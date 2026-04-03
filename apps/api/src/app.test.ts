import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseClient } from "@dupe-hunt/db";

import { signAccessToken, type AuthProvider, type AuthSession } from "./auth.ts";
import { ApiError, buildApiServer, type RedisClient } from "./app.ts";
import { loadApiConfig, type ApiConfig } from "./config.ts";
import {
  type ApiRepository,
  type CategoryRecord,
  type CreateUserInput,
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
    }
  };

  return {
    repository,
    users,
    userCategorySelections
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
  const { repository, users, userCategorySelections } = createRepositoryDouble();
  const { authProvider, createSession } = createAuthProviderDouble(config);
  const app = buildApiServer({
    config,
    database: createDatabaseDouble(),
    redis: createRedisDouble(),
    repository,
    authProvider
  });

  return {
    app,
    config,
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
