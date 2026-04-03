import assert from "node:assert/strict";
import test from "node:test";

import type { DatabaseClient } from "@dupe-hunt/db";

import { ApiError, buildApiServer, type RedisClient } from "./app.ts";
import { loadApiConfig, type ApiConfig } from "./config.ts";

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
  const app = buildApiServer({
    config: createTestConfig(),
    database: createDatabaseDouble(),
    redis: createRedisDouble()
  });

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

test("unknown routes use the shared error payload shape", async (context) => {
  const app = buildApiServer({
    config: createTestConfig(),
    database: createDatabaseDouble(),
    redis: createRedisDouble()
  });

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
  const app = buildApiServer({
    config: createTestConfig(),
    database: createDatabaseDouble(),
    redis: createRedisDouble()
  });

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
