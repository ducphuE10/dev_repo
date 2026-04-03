import { randomInt } from "node:crypto";

import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import { createDatabaseClient, type DatabaseClient } from "@dupe-hunt/db";

import {
  createSupabaseAuthProvider,
  readBearerToken,
  type AuthProvider,
  type AuthSession,
  type OAuthRequest,
  verifyAccessToken
} from "./auth.ts";
import { loadApiConfig, type ApiConfig } from "./config.ts";
import {
  createDatabaseRepository,
  type ApiRepository,
  type CategoryRecord,
  type UpdateUserProfileInput,
  type UserRecord
} from "./repository.ts";

export interface RedisClient {
  url: string;
  ping: () => Promise<"PONG">;
  close: () => Promise<void>;
}

export interface BuildApiServerOptions {
  config?: ApiConfig;
  database?: DatabaseClient;
  redis?: RedisClient;
  repository?: ApiRepository;
  authProvider?: AuthProvider;
  logger?: boolean;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const createRedisClient = (url: string): RedisClient => ({
  url,
  ping: async () => "PONG",
  close: async () => undefined
});

declare module "fastify" {
  interface FastifyInstance {
    config: ApiConfig;
    database: DatabaseClient;
    redis: RedisClient;
    repository: ApiRepository;
    authProvider: AuthProvider;
  }
}

type RequestError = Error & { statusCode?: number; validation?: unknown; code?: string };

const sendErrorResponse = (reply: FastifyReply, statusCode: number, code: string, message: string) =>
  reply.status(statusCode).send({
    error: {
      code,
      message
    }
  });

const getErrorPayload = (error: RequestError) => {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    };
  }

  if (error.validation) {
    return {
      code: "VALIDATION_ERROR",
      message: error.message,
      statusCode: 400
    };
  }

  if (typeof error.code === "string" && typeof error.statusCode === "number") {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    statusCode: error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
  };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9_]{3,30}$/i;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireObject = (value: unknown, message = "Request body must be an object.") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", message);
  }

  return value as Record<string, unknown>;
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} is required.`);
  }

  return value.trim();
};

const readOptionalString = (value: unknown, fieldName: string, maxLength: number) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} cannot be empty.`);
  }

  if (normalized.length > maxLength) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
};

const normalizeEmail = (value: unknown) => {
  const email = requireString(value, "email").toLowerCase();

  if (!emailPattern.test(email)) {
    throw new ApiError(400, "VALIDATION_ERROR", "email must be a valid email address.");
  }

  return email;
};

const normalizeUsername = (value: unknown) => {
  const username = requireString(value, "username");

  if (!usernamePattern.test(username)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "username must be 3 to 30 characters and contain only letters, numbers, or underscores."
    );
  }

  return username;
};

const normalizePassword = (value: unknown) => {
  const password = requireString(value, "password");

  if (password.length < 8) {
    throw new ApiError(400, "VALIDATION_ERROR", "password must be at least 8 characters long.");
  }

  return password;
};

const normalizeUserId = (value: string) => {
  if (!uuidPattern.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "user id must be a valid UUID.");
  }

  return value;
};

const readCategoryIds = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "category_ids must be a non-empty array.");
  }

  const categoryIds = value.map((entry) => {
    if (!Number.isInteger(entry) || (entry as number) < 1) {
      throw new ApiError(400, "VALIDATION_ERROR", "category_ids must contain positive integers.");
    }

    return entry as number;
  });

  return Array.from(new Set(categoryIds));
};

const toPublicUser = (user: UserRecord) => ({
  id: user.id,
  username: user.username,
  avatar_url: user.avatarUrl,
  bio: user.bio,
  verified_buy_count: user.verifiedBuyCount,
  total_upvotes: user.totalUpvotes,
  contributor_tier: user.contributorTier,
  created_at: user.createdAt,
  last_active_at: user.lastActiveAt
});

const toCurrentUser = (user: UserRecord) => ({
  ...toPublicUser(user),
  email: user.email,
  posts_per_day_count: user.postsPerDayCount,
  last_post_date: user.lastPostDate
});

const toCategory = (category: CategoryRecord) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  icon: category.icon,
  post_count: category.postCount,
  sort_order: category.sortOrder
});

const toAuthResponse = (user: UserRecord, session: AuthSession) => ({
  user: {
    id: user.id,
    username: user.username
  },
  token: session.accessToken,
  refresh_token: session.refreshToken
});

const deriveUsername = (source: string) => {
  const base = source
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  if (base.length >= 3) {
    return base;
  }

  return `user_${randomInt(1000, 9999)}`;
};

const generateUniqueUsername = async (repository: ApiRepository, source: string) => {
  const base = deriveUsername(source);

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base.slice(0, Math.max(3, 30 - String(index).length))}${index}`;
    const existingUser = await repository.findUserByUsername(candidate);

    if (!existingUser) {
      return candidate;
    }
  }

  throw new ApiError(500, "USERNAME_GENERATION_FAILED", "Unable to allocate a unique username.");
};

const ensureIdentityUser = async (
  repository: ApiRepository,
  session: AuthSession,
  preferredUsername?: string
) => {
  const existingUser = await repository.findUserById(session.userId);

  if (existingUser) {
    await repository.touchUser(existingUser.id);
    return existingUser;
  }

  const emailUser = await repository.findUserByEmail(session.email);

  if (emailUser && emailUser.id !== session.userId) {
    throw new ApiError(409, "EMAIL_CONFLICT", "A profile already exists for this email address.");
  }

  const username = preferredUsername
    ? await generateUniqueUsername(repository, preferredUsername)
    : await generateUniqueUsername(repository, session.email.split("@")[0] ?? "user");

  return repository.createUser({
    id: session.userId,
    username,
    email: session.email
  });
};

const requireAuthenticatedUser = async (request: FastifyRequest, app: FastifyInstance) => {
  const accessToken = readBearerToken(request.headers.authorization);
  const claims = verifyAccessToken(accessToken, app.config.jwtSecret);
  const user = await app.repository.findUserById(claims.sub);

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authenticated user was not found.");
  }

  return {
    accessToken,
    user
  };
};

const registerHealthRoute = (app: FastifyInstance) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "@dupe-hunt/api",
    environment: app.config.nodeEnv,
    dependencies: {
      database: "configured",
      redis: "configured"
    }
  }));
};

const registerAuthRoutes = (app: FastifyInstance) => {
  app.post("/auth/register", async (request, reply) => {
    const body = requireObject(request.body);
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);

    if (await app.repository.findUserByUsername(username)) {
      throw new ApiError(409, "USERNAME_CONFLICT", "That username is already taken.");
    }

    if (await app.repository.findUserByEmail(email)) {
      throw new ApiError(409, "EMAIL_CONFLICT", "That email address is already registered.");
    }

    const session = await app.authProvider.register({
      username,
      email,
      password
    });
    const user = await app.repository.createUser({
      id: session.userId,
      username,
      email: session.email
    });

    return reply.status(201).send(toAuthResponse(user, session));
  });

  app.post("/auth/login", async (request) => {
    const body = requireObject(request.body);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const session = await app.authProvider.login({
      email,
      password
    });
    const user = await ensureIdentityUser(app.repository, session);

    return toAuthResponse(user, session);
  });

  app.post("/auth/logout", async (request, reply) => {
    const authenticated = await requireAuthenticatedUser(request, app);
    const body = requireObject(request.body);
    const refreshToken = requireString(body.refresh_token, "refresh_token");

    await app.authProvider.logout({
      accessToken: authenticated.accessToken,
      refreshToken
    });

    return reply.status(204).send();
  });

  app.post("/auth/refresh", async (request) => {
    const body = requireObject(request.body);
    const refreshToken = requireString(body.refresh_token, "refresh_token");
    const session = await app.authProvider.refresh({
      refreshToken
    });
    const user = await ensureIdentityUser(app.repository, session);

    return toAuthResponse(user, session);
  });

  const oauthHandler = (provider: OAuthRequest["provider"]) => async (request: FastifyRequest) => {
    const body = requireObject(request.body);
    const code = typeof body.code === "string" ? body.code.trim() : undefined;
    const token = typeof body.token === "string" ? body.token.trim() : undefined;

    if (!code && !token) {
      throw new ApiError(400, "VALIDATION_ERROR", "OAuth requests require either code or token.");
    }

    const session = await app.authProvider.exchangeOAuth({
      provider,
      code,
      codeVerifier: typeof body.code_verifier === "string" ? body.code_verifier.trim() : undefined,
      redirectUri: typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : undefined,
      token,
      accessToken: typeof body.access_token === "string" ? body.access_token.trim() : undefined,
      nonce: typeof body.nonce === "string" ? body.nonce.trim() : undefined
    });
    const user = await ensureIdentityUser(app.repository, session, session.email.split("@")[0]);

    return toAuthResponse(user, session);
  };

  app.post("/auth/oauth/google", oauthHandler("google"));
  app.post("/auth/oauth/apple", oauthHandler("apple"));
};

const registerUserRoutes = (app: FastifyInstance) => {
  app.get("/users/me", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);

    return {
      user: toCurrentUser(user)
    };
  });

  app.patch("/users/me", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const body = requireObject(request.body);
    const updates: UpdateUserProfileInput = {};

    if (body.username !== undefined) {
      const username = normalizeUsername(body.username);
      const existingUser = await app.repository.findUserByUsername(username);

      if (existingUser && existingUser.id !== user.id) {
        throw new ApiError(409, "USERNAME_CONFLICT", "That username is already taken.");
      }

      updates.username = username;
    }

    if (body.bio !== undefined) {
      updates.bio = readOptionalString(body.bio, "bio", 160);
    }

    if (body.avatar_url !== undefined) {
      updates.avatarUrl = readOptionalString(body.avatar_url, "avatar_url", 2048);
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Provide at least one profile field to update.");
    }

    const updatedUser = await app.repository.updateUserProfile(user.id, updates);

    if (!updatedUser) {
      throw new ApiError(404, "USER_NOT_FOUND", "User profile was not found.");
    }

    return {
      user: toCurrentUser(updatedUser)
    };
  });

  app.get("/users/me/categories", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const categories = await app.repository.listUserCategories(user.id);

    return {
      categories: categories.map(toCategory)
    };
  });

  app.put("/users/me/categories", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const body = requireObject(request.body);
    const categoryIds = readCategoryIds(body.category_ids);
    const activeCategories = await app.repository.listActiveCategories();
    const activeCategoryIds = new Set(activeCategories.map((category) => category.id));

    if (!categoryIds.every((categoryId) => activeCategoryIds.has(categoryId))) {
      throw new ApiError(400, "INVALID_CATEGORY_SELECTION", "category_ids must reference active categories.");
    }

    const categories = await app.repository.replaceUserCategories(user.id, categoryIds);

    return {
      categories: categories.map(toCategory)
    };
  });

  app.get("/users/:id", async (request) => {
    const params = requireObject(request.params, "Route params must be an object.");
    const userId = normalizeUserId(requireString(params.id, "id"));
    const user = await app.repository.findUserById(userId);

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User profile was not found.");
    }

    return {
      user: toPublicUser(user)
    };
  });
};

const registerCategoryRoutes = (app: FastifyInstance) => {
  app.get("/categories", async () => {
    const categories = await app.repository.listActiveCategories();

    return {
      categories: categories.map(toCategory)
    };
  });
};

export const buildApiServer = (options: BuildApiServerOptions = {}): FastifyInstance => {
  const config = options.config ?? loadApiConfig();
  const database = options.database ?? createDatabaseClient(config.databaseUrl, { max: 1 });
  const redis = options.redis ?? createRedisClient(config.redisUrl);
  const repository = options.repository ?? createDatabaseRepository(database);
  const authProvider = options.authProvider ?? createSupabaseAuthProvider(config);
  const app = fastify({
    logger: options.logger ?? false
  });
  const ownsDatabase = !options.database;
  const ownsRedis = !options.redis;

  app.decorate("config", config);
  app.decorate("database", database);
  app.decorate("redis", redis);
  app.decorate("repository", repository);
  app.decorate("authProvider", authProvider);

  app.setNotFoundHandler((request, reply) =>
    sendErrorResponse(reply, 404, "NOT_FOUND", `Route ${request.method}:${request.url} not found`)
  );

  app.setErrorHandler((error: RequestError, _request, reply) => {
    const payload = getErrorPayload(error);

    if (payload.statusCode >= 500) {
      app.log.error(error);
    }

    return sendErrorResponse(reply, payload.statusCode, payload.code, payload.message);
  });

  registerHealthRoute(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerCategoryRoutes(app);

  app.addHook("onClose", async () => {
    if (ownsRedis) {
      await redis.close();
    }

    if (ownsDatabase) {
      await database.close();
    }
  });

  return app;
};
