import { createHmac, randomInt, randomUUID } from "node:crypto";

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
  type CreatePostInput,
  type FeedTab,
  type FlagReason,
  type PostMediaType,
  type PostRecord,
  type SearchSort,
  type UpdateUserProfileInput,
  type UserRecord
} from "./repository.ts";

export interface RedisClient {
  url: string;
  ping: () => Promise<"PONG">;
  incrementSortedSetMember: (key: string, member: string, increment?: number) => Promise<void>;
  getTopSortedSetMembers: (key: string, limit: number) => Promise<Array<{ member: string; score: number }>>;
  close: () => Promise<void>;
}

export type BackgroundJobName =
  | "process-video"
  | "wrap-affiliate-link"
  | "update-post-counts"
  | "auto-flag-review";

export interface BackgroundJobQueue {
  enqueue: (jobName: BackgroundJobName, payload: Record<string, unknown>) => Promise<void>;
  close: () => Promise<void>;
}

export interface BuildApiServerOptions {
  config?: ApiConfig;
  database?: DatabaseClient;
  redis?: RedisClient;
  repository?: ApiRepository;
  authProvider?: AuthProvider;
  jobs?: BackgroundJobQueue;
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
  incrementSortedSetMember: async () => undefined,
  getTopSortedSetMembers: async () => [],
  close: async () => undefined
});

export const createBackgroundJobQueue = (): BackgroundJobQueue => ({
  enqueue: async () => undefined,
  close: async () => undefined
});

declare module "fastify" {
  interface FastifyInstance {
    config: ApiConfig;
    database: DatabaseClient;
    redis: RedisClient;
    repository: ApiRepository;
    authProvider: AuthProvider;
    jobs: BackgroundJobQueue;
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
const currencyPattern = /^[A-Z]{3}$/;
const feedTabs = new Set<FeedTab>(["for_you", "trending", "new"]);
const mediaTypes = new Set<PostMediaType>(["photo", "video"]);
const flagReasons = new Set<FlagReason>(["spam", "fake", "inappropriate", "affiliate_abuse"]);
const searchSorts = new Set<SearchSort>(["upvotes", "newest"]);
const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
const searchTrendingRedisKey = "search:trending";

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
  if (value === undefined || value === null) {
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

const normalizeUuid = (value: string, fieldName: string) => {
  if (!uuidPattern.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a valid UUID.`);
  }

  return value;
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

const normalizeUserId = (value: string) => normalizeUuid(value, "user id");

const normalizePostId = (value: string) => normalizeUuid(value, "post id");

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

const readOptionalUrl = (value: unknown, fieldName: string) => {
  const url = readOptionalString(value, fieldName, 2048);

  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).toString();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a valid absolute URL.`);
  }
};

const readRequiredUrl = (value: unknown, fieldName: string) => {
  const url = requireString(value, fieldName);

  try {
    return new URL(url).toString();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a valid absolute URL.`);
  }
};

const readRequiredPrice = (value: unknown, fieldName: string) => {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" && value.trim().length > 0 ? Number(value) : NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a positive number.`);
  }

  return Number(numericValue.toFixed(2));
};

const readCurrency = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null) {
    return "USD";
  }

  const currency = requireString(value, fieldName).toUpperCase();

  if (!currencyPattern.test(currency)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a 3-letter currency code.`);
  }

  return currency;
};

const normalizeMediaType = (value: unknown): PostMediaType => {
  const mediaType = requireString(value, "media_type").toLowerCase();

  if (!mediaTypes.has(mediaType as PostMediaType)) {
    throw new ApiError(400, "VALIDATION_ERROR", "media_type must be either photo or video.");
  }

  return mediaType as PostMediaType;
};

const readMediaUrls = (value: unknown, mediaType: PostMediaType) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "media_urls must be a non-empty array of URLs.");
  }

  if (mediaType === "video" && value.length !== 1) {
    throw new ApiError(400, "VALIDATION_ERROR", "video posts must include exactly one media URL.");
  }

  if (mediaType === "photo" && value.length > 5) {
    throw new ApiError(400, "VALIDATION_ERROR", "photo posts can include at most five media URLs.");
  }

  return value.map((entry, index) => readRequiredUrl(entry, `media_urls[${index}]`));
};

const readOptionalBooleanQuery = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return false;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be true or false.`);
};

const readPositiveInteger = (value: unknown, fieldName: string) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a positive integer.`);
  }

  return numericValue;
};

const readFeedLimit = (value: unknown) => {
  if (value === undefined) {
    return 20;
  }

  const limit = readPositiveInteger(value, "limit");

  if (limit > 50) {
    throw new ApiError(400, "VALIDATION_ERROR", "limit cannot be greater than 50.");
  }

  return limit;
};

const readSearchSort = (value: unknown): SearchSort => {
  if (value === undefined) {
    return "upvotes";
  }

  const sort = requireString(value, "sort").toLowerCase();

  if (!searchSorts.has(sort as SearchSort)) {
    throw new ApiError(400, "VALIDATION_ERROR", "sort must be either upvotes or newest.");
  }

  return sort as SearchSort;
};

const readFeedTab = (value: unknown): FeedTab => {
  if (value === undefined) {
    return "for_you";
  }

  const tab = requireString(value, "tab").toLowerCase();

  if (!feedTabs.has(tab as FeedTab)) {
    throw new ApiError(400, "VALIDATION_ERROR", "tab must be one of for_you, trending, or new.");
  }

  return tab as FeedTab;
};

const readOptionalCategorySlug = (value: unknown) => {
  const category = readOptionalString(value, "category", 50);

  return category?.toLowerCase();
};

const readReviewText = (value: unknown) => readOptionalString(value, "review_text", 280);

const readFlagReason = (value: unknown): FlagReason => {
  const reason = requireString(value, "reason").toLowerCase();

  if (!flagReasons.has(reason as FlagReason)) {
    throw new ApiError(400, "VALIDATION_ERROR", "reason must be one of spam, fake, inappropriate, or affiliate_abuse.");
  }

  return reason as FlagReason;
};

const readUploadContentType = (value: unknown, mediaType: PostMediaType) => {
  const contentType = requireString(value, "content_type").toLowerCase();
  const isValid = mediaType === "photo" ? contentType.startsWith("image/") : contentType.startsWith("video/");

  if (!isValid) {
    throw new ApiError(400, "VALIDATION_ERROR", `content_type must match media_type ${mediaType}.`);
  }

  return contentType;
};

const inferFileExtension = (fileName: string | undefined, contentType: string) => {
  const normalizedFileName = fileName?.trim().toLowerCase();
  const fileExtension = normalizedFileName?.includes(".") ? normalizedFileName.split(".").pop() : undefined;

  if (fileExtension && /^[a-z0-9]+$/.test(fileExtension)) {
    return fileExtension;
  }

  const subtype = contentType.split("/")[1] ?? "bin";

  return subtype.replace(/[^a-z0-9]+/g, "") || "bin";
};

const inferAffiliatePlatform = (url: string | undefined) => {
  if (!url) {
    return undefined;
  }

  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("amazon.")) {
    return "amazon";
  }

  if (hostname.includes("walmart.")) {
    return "walmart";
  }

  if (hostname.includes("target.")) {
    return "target";
  }

  if (hostname.includes("tiktok.")) {
    return "tiktok_shop";
  }

  if (hostname.includes("etsy.")) {
    return "etsy";
  }

  return "other";
};

const normalizeSearchTerm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const applyAffiliateTracking = (url: string, platform: string | null) => {
  const redirectUrl = new URL(url);

  redirectUrl.searchParams.set("utm_source", "dupehunt");
  redirectUrl.searchParams.set("utm_medium", "affiliate");

  if (platform === "amazon" && !redirectUrl.searchParams.has("tag")) {
    redirectUrl.searchParams.set("tag", "dupehunt-20");
  }

  if (platform === "walmart" && !redirectUrl.searchParams.has("athbdg")) {
    redirectUrl.searchParams.set("athbdg", "L1100");
  }

  if (platform === "target" && !redirectUrl.searchParams.has("clkid")) {
    redirectUrl.searchParams.set("clkid", "dupehunt");
  }

  return redirectUrl.toString();
};

const createUploadSignature = (key: string, contentType: string, expiresAt: number, secret: string) =>
  createHmac("sha256", secret).update(`${key}:${contentType}:${expiresAt}`).digest("hex");

const createMediaStorageKey = (userId: string, mediaType: PostMediaType, fileName: string | undefined, contentType: string) =>
  `posts/${userId}/${mediaType}/${randomUUID()}.${inferFileExtension(fileName, contentType)}`;

const createMediaUploadUrl = (
  config: ApiConfig,
  key: string,
  contentType: string,
  expiresAt: number
) => {
  const uploadUrl = new URL(
    `https://${config.cloudflareR2AccountId}.r2.cloudflarestorage.com/${config.cloudflareR2Bucket}/${key}`
  );

  uploadUrl.searchParams.set(
    "signature",
    createUploadSignature(key, contentType, expiresAt, config.cloudflareR2SecretKey)
  );
  uploadUrl.searchParams.set("expires", String(expiresAt));
  uploadUrl.searchParams.set("content_type", contentType);

  return uploadUrl.toString();
};

const createPublicMediaUrl = (config: ApiConfig, key: string) => `https://${config.cloudflareR2Bucket}.r2.dev/${key}`;

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

const toPost = (post: PostRecord) => ({
  id: post.id,
  original_product_name: post.originalProductName,
  original_brand: post.originalBrand,
  original_price: post.originalPrice,
  original_currency: post.originalCurrency,
  dupe_product_name: post.dupeProductName,
  dupe_brand: post.dupeBrand,
  dupe_price: post.dupePrice,
  dupe_currency: post.dupeCurrency,
  price_saved: post.priceSaved,
  media_type: post.mediaType,
  media_urls: post.mediaUrls,
  review_text: post.reviewText,
  affiliate_link: post.affiliateLink,
  affiliate_platform: post.affiliatePlatform,
  upvote_count: post.upvoteCount,
  downvote_count: post.downvoteCount,
  flag_count: post.flagCount,
  is_verified_buy: post.isVerifiedBuy,
  status: post.status,
  created_at: post.createdAt,
  updated_at: post.updatedAt,
  user: {
    id: post.user.id,
    username: post.user.username,
    avatar_url: post.user.avatarUrl,
    verified_buy_count: post.user.verifiedBuyCount,
    contributor_tier: post.user.contributorTier
  },
  category: toCategory(post.category)
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

const readOptionalAuthenticatedUser = async (request: FastifyRequest, app: FastifyInstance) => {
  if (!request.headers.authorization) {
    return null;
  }

  return requireAuthenticatedUser(request, app);
};

const requireAdminRequest = (request: FastifyRequest, app: FastifyInstance) => {
  const adminKey = request.headers["x-admin-key"];

  if (typeof adminKey !== "string" || adminKey !== app.config.adminApiKey) {
    throw new ApiError(401, "ADMIN_UNAUTHORIZED", "A valid admin key is required.");
  }
};

const resolveCategoryFilterIds = async (
  app: FastifyInstance,
  tab: FeedTab,
  categorySlug: string | undefined,
  userId: string | undefined
) => {
  const activeCategories = await app.repository.listActiveCategories();
  const requestedCategory = categorySlug
    ? activeCategories.find((category) => category.slug === categorySlug)
    : undefined;

  if (categorySlug && !requestedCategory) {
    throw new ApiError(400, "INVALID_CATEGORY_FILTER", "category must reference an active category slug.");
  }

  if (tab !== "for_you" || !userId) {
    return requestedCategory ? [requestedCategory.id] : undefined;
  }

  const preferredCategoryIds = (await app.repository.listUserCategories(userId)).map((category) => category.id);

  if (preferredCategoryIds.length === 0) {
    return requestedCategory ? [requestedCategory.id] : undefined;
  }

  if (!requestedCategory) {
    return preferredCategoryIds;
  }

  return preferredCategoryIds.includes(requestedCategory.id) ? [requestedCategory.id] : [];
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

  app.get("/users/me/saves", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const posts = await app.repository.listSavedPosts(user.id);

    return {
      posts: posts.map(toPost)
    };
  });

  app.post("/users/:id/follow", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const targetUserId = normalizeUserId(requireString(params.id, "id"));

    if (targetUserId === user.id) {
      throw new ApiError(400, "INVALID_FOLLOW_TARGET", "You cannot follow yourself.");
    }

    const targetUser = await app.repository.findUserById(targetUserId);

    if (!targetUser) {
      throw new ApiError(404, "USER_NOT_FOUND", "User profile was not found.");
    }

    await app.repository.followUser(user.id, targetUserId);

    return reply.status(204).send();
  });

  app.delete("/users/:id/follow", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const targetUserId = normalizeUserId(requireString(params.id, "id"));

    if (targetUserId === user.id) {
      throw new ApiError(400, "INVALID_FOLLOW_TARGET", "You cannot unfollow yourself.");
    }

    await app.repository.unfollowUser(user.id, targetUserId);

    return reply.status(204).send();
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

const registerUploadRoutes = (app: FastifyInstance) => {
  app.post("/upload/media", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const body = requireObject(request.body);
    const mediaType = normalizeMediaType(body.media_type);
    const contentType = readUploadContentType(body.content_type, mediaType);
    const fileName = readOptionalString(body.file_name, "file_name", 255);
    const key = createMediaStorageKey(user.id, mediaType, fileName, contentType);
    const expiresIn = 300;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    return {
      upload_url: createMediaUploadUrl(app.config, key, contentType, expiresAt),
      media_url: createPublicMediaUrl(app.config, key),
      expires_in: expiresIn
    };
  });
};

const registerPostRoutes = (app: FastifyInstance) => {
  app.post("/posts", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const body = requireObject(request.body);
    const categoryId = readPositiveInteger(body.category_id, "category_id");
    const activeCategories = await app.repository.listActiveCategories();

    if (!activeCategories.some((category) => category.id === categoryId)) {
      throw new ApiError(400, "INVALID_CATEGORY_SELECTION", "category_id must reference an active category.");
    }

    const mediaType = normalizeMediaType(body.media_type);
    const affiliateLink = readOptionalUrl(body.affiliate_link, "affiliate_link");
    const input: CreatePostInput = {
      userId: user.id,
      categoryId,
      originalProductName: requireString(body.original_product_name, "original_product_name"),
      originalBrand: readOptionalString(body.original_brand, "original_brand", 100),
      originalPrice: readRequiredPrice(body.original_price, "original_price"),
      originalCurrency: readCurrency(body.original_currency, "original_currency"),
      dupeProductName: requireString(body.dupe_product_name, "dupe_product_name"),
      dupeBrand: readOptionalString(body.dupe_brand, "dupe_brand", 100),
      dupePrice: readRequiredPrice(body.dupe_price, "dupe_price"),
      dupeCurrency: readCurrency(body.dupe_currency, "dupe_currency"),
      mediaType,
      mediaUrls: readMediaUrls(body.media_urls, mediaType),
      reviewText: readReviewText(body.review_text),
      affiliateLink,
      affiliatePlatform: inferAffiliatePlatform(affiliateLink)
    };
    const post = await app.repository.createPost(input);

    if (post.mediaType === "video") {
      await app.jobs.enqueue("process-video", {
        postId: post.id,
        userId: user.id,
        mediaUrls: post.mediaUrls
      });
    }

    if (post.affiliateLink) {
      await app.jobs.enqueue("wrap-affiliate-link", {
        postId: post.id,
        affiliateLink: post.affiliateLink,
        affiliatePlatform: post.affiliatePlatform
      });
    }

    return reply.status(201).send({
      post: toPost(post)
    });
  });

  app.get("/posts", async (request) => {
    const authenticated = await readOptionalAuthenticatedUser(request, app);
    const query = requireObject(request.query, "Query params must be an object.");
    const tab = readFeedTab(query.tab);
    const categorySlug = readOptionalCategorySlug(query.category);
    const verifiedOnly = readOptionalBooleanQuery(query.verified, "verified");
    const limit = readFeedLimit(query.limit);
    const cursor = query.cursor === undefined ? undefined : normalizePostId(requireString(query.cursor, "cursor"));

    if (cursor) {
      const cursorPost = await app.repository.findPostById(cursor);

      if (!cursorPost) {
        throw new ApiError(400, "INVALID_CURSOR", "cursor must reference an active post.");
      }
    }

    const categoryIds = await resolveCategoryFilterIds(app, tab, categorySlug, authenticated?.user.id);

    if (categoryIds && categoryIds.length === 0) {
      return {
        posts: [],
        next_cursor: null
      };
    }

    const posts = await app.repository.listPosts({
      tab,
      categoryIds,
      verifiedOnly,
      cursor,
      limit: limit + 1
    });
    const page = posts.slice(0, limit);
    const hasMore = posts.length > limit;

    return {
      posts: page.map(toPost),
      next_cursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  });

  app.get("/posts/:id", async (request) => {
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.findPostById(postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    return {
      post: toPost(post)
    };
  });

  app.post("/posts/:id/upvote", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.upvotePost(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    await app.jobs.enqueue("update-post-counts", {
      postId,
      actorUserId: user.id,
      event: "upvote"
    });

    return {
      post: toPost(post)
    };
  });

  app.delete("/posts/:id/upvote", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.removeUpvote(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    await app.jobs.enqueue("update-post-counts", {
      postId,
      actorUserId: user.id,
      event: "remove_upvote"
    });

    return reply.status(204).send();
  });

  app.post("/posts/:id/downvote", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.downvotePost(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    await app.jobs.enqueue("update-post-counts", {
      postId,
      actorUserId: user.id,
      event: "downvote"
    });

    return {
      post: toPost(post)
    };
  });

  app.delete("/posts/:id/downvote", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.removeDownvote(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    await app.jobs.enqueue("update-post-counts", {
      postId,
      actorUserId: user.id,
      event: "remove_downvote"
    });

    return reply.status(204).send();
  });

  app.post("/posts/:id/save", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.savePost(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    return {
      post: toPost(post)
    };
  });

  app.delete("/posts/:id/save", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.removeSavedPost(user.id, postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    return reply.status(204).send();
  });

  app.post("/posts/:id/flag", async (request) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const body = requireObject(request.body);
    const postId = normalizePostId(requireString(params.id, "id"));
    const reason = readFlagReason(body.reason);
    const post = await app.repository.flagPost(user.id, postId, reason);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    await app.jobs.enqueue("update-post-counts", {
      postId,
      actorUserId: user.id,
      event: "flag",
      reason
    });

    if (post.flagCount >= 5) {
      await app.jobs.enqueue("auto-flag-review", {
        postId,
        flagCount: post.flagCount
      });
    }

    return {
      post: toPost(post)
    };
  });

  app.delete("/posts/:id", async (request, reply) => {
    const { user } = await requireAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.id, "id"));
    const post = await app.repository.findPostById(postId, { includeInactive: true });

    if (!post || post.status === "removed") {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    if (post.user.id !== user.id) {
      throw new ApiError(403, "FORBIDDEN", "You can only delete your own posts.");
    }

    await app.repository.softDeletePost(postId);

    return reply.status(204).send();
  });
};

const registerSearchRoutes = (app: FastifyInstance) => {
  app.get("/search", async (request) => {
    const query = requireObject(request.query, "Query params must be an object.");
    const searchQuery = normalizeSearchTerm(requireString(query.q, "q"));
    const categorySlug = readOptionalCategorySlug(query.category);
    const verifiedOnly = readOptionalBooleanQuery(query.verified, "verified");
    const sort = readSearchSort(query.sort);
    const limit = readFeedLimit(query.limit);
    const cursor = query.cursor === undefined ? undefined : normalizePostId(requireString(query.cursor, "cursor"));
    const activeCategories = await app.repository.listActiveCategories();
    const requestedCategory = categorySlug
      ? activeCategories.find((category) => category.slug === categorySlug)
      : undefined;

    if (categorySlug && !requestedCategory) {
      throw new ApiError(400, "INVALID_CATEGORY_FILTER", "category must reference an active category slug.");
    }

    if (cursor) {
      const cursorPost = await app.repository.findPostById(cursor);

      if (!cursorPost) {
        throw new ApiError(400, "INVALID_CURSOR", "cursor must reference an active post.");
      }
    }

    const posts = await app.repository.searchPosts({
      query: searchQuery,
      categoryIds: requestedCategory ? [requestedCategory.id] : undefined,
      verifiedOnly,
      sort,
      cursor,
      limit: limit + 1
    });
    const page = posts.slice(0, limit);
    const hasMore = posts.length > limit;

    await app.redis.incrementSortedSetMember(searchTrendingRedisKey, searchQuery, 1);

    return {
      posts: page.map(toPost),
      next_cursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  });

  app.get("/search/trending", async (request) => {
    const query = requireObject(request.query, "Query params must be an object.");
    const limit = query.limit === undefined ? 10 : readPositiveInteger(query.limit, "limit");
    const terms = await app.redis.getTopSortedSetMembers(searchTrendingRedisKey, Math.min(limit, 20));

    return {
      terms: terms.map((term) => ({
        term: term.member,
        search_count: term.score
      }))
    };
  });
};

const registerAffiliateRoutes = (app: FastifyInstance) => {
  app.get("/affiliate/go/:postId", async (request, reply) => {
    const authenticated = await readOptionalAuthenticatedUser(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const postId = normalizePostId(requireString(params.postId, "postId"));
    const post = await app.repository.findPostById(postId);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    if (!post.affiliateLink) {
      throw new ApiError(404, "AFFILIATE_LINK_NOT_FOUND", "This post does not have an affiliate link.");
    }

    const sessionIdHeader = request.headers["x-session-id"];
    const sessionId =
      typeof sessionIdHeader === "string" && sessionIdHeader.trim().length > 0 ? sessionIdHeader.trim() : randomUUID();

    await app.repository.recordAffiliateClick(post.id, authenticated?.user.id ?? null, sessionId);

    return reply.redirect(applyAffiliateTracking(post.affiliateLink, post.affiliatePlatform), 302);
  });
};

const registerAdminRoutes = (app: FastifyInstance) => {
  app.get("/admin/flags", async (request) => {
    requireAdminRequest(request, app);
    const posts = await app.repository.listFlaggedPosts();

    return {
      posts: posts.map(toPost)
    };
  });

  app.patch("/admin/posts/:id", async (request) => {
    requireAdminRequest(request, app);
    const params = requireObject(request.params, "Route params must be an object.");
    const body = requireObject(request.body);
    const postId = normalizePostId(requireString(params.id, "id"));
    const status = requireString(body.status, "status").toLowerCase();

    if (status !== "active" && status !== "flagged" && status !== "removed") {
      throw new ApiError(400, "VALIDATION_ERROR", "status must be one of active, flagged, or removed.");
    }

    const post = await app.repository.updatePostStatus(postId, status);

    if (!post) {
      throw new ApiError(404, "POST_NOT_FOUND", "Post was not found.");
    }

    return {
      post: toPost(post)
    };
  });

  app.get("/admin/stats", async (request) => {
    requireAdminRequest(request, app);
    const stats = await app.repository.getAdminStats();

    return {
      stats: {
        total_users: stats.totalUsers,
        total_posts: stats.totalPosts,
        active_posts: stats.activePosts,
        flagged_posts: stats.flaggedPosts,
        removed_posts: stats.removedPosts,
        affiliate_clicks: stats.affiliateClicks,
        affiliate_conversions: stats.affiliateConversions,
        affiliate_commission_amount: stats.affiliateCommissionAmount
      }
    };
  });
};

export const buildApiServer = (options: BuildApiServerOptions = {}): FastifyInstance => {
  const config = options.config ?? loadApiConfig();
  const database = options.database ?? createDatabaseClient(config.databaseUrl, { max: 1 });
  const redis = options.redis ?? createRedisClient(config.redisUrl);
  const repository = options.repository ?? createDatabaseRepository(database);
  const authProvider = options.authProvider ?? createSupabaseAuthProvider(config);
  const jobs = options.jobs ?? createBackgroundJobQueue();
  const app = fastify({
    logger: options.logger ?? false
  });
  const ownsDatabase = !options.database;
  const ownsRedis = !options.redis;
  const ownsJobs = !options.jobs;

  app.decorate("config", config);
  app.decorate("database", database);
  app.decorate("redis", redis);
  app.decorate("repository", repository);
  app.decorate("authProvider", authProvider);
  app.decorate("jobs", jobs);

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
  registerUploadRoutes(app);
  registerPostRoutes(app);
  registerSearchRoutes(app);
  registerAffiliateRoutes(app);
  registerAdminRoutes(app);

  app.addHook("onClose", async () => {
    if (ownsJobs) {
      await jobs.close();
    }

    if (ownsRedis) {
      await redis.close();
    }

    if (ownsDatabase) {
      await database.close();
    }
  });

  return app;
};
