import { createHmac, timingSafeEqual } from "node:crypto";

import type { ApiConfig } from "./config.ts";

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  provider: "password" | "google" | "apple";
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface OAuthRequest {
  provider: "google" | "apple";
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  token?: string;
  accessToken?: string;
  nonce?: string;
}

export interface VerifiedAccessToken {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface AuthProvider {
  register: (credentials: RegisterCredentials) => Promise<AuthSession>;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: (request: LogoutRequest) => Promise<void>;
  refresh: (request: RefreshRequest) => Promise<AuthSession>;
  exchangeOAuth: (request: OAuthRequest) => Promise<AuthSession>;
}

type AuthError = Error & { statusCode?: number; code?: string };

interface SupabaseSessionResponse {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
  error_description?: string;
  msg?: string;
}

const createAuthError = (statusCode: number, code: string, message: string): AuthError => {
  const error = new Error(message) as AuthError;
  error.name = "AuthError";
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;

  if (remainder === 0) {
    return normalized;
  }

  return normalized.padEnd(normalized.length + (4 - remainder), "=");
};

const decodeBase64UrlJson = (value: string): Record<string, unknown> => {
  const decoded = Buffer.from(normalizeBase64Url(value), "base64").toString("utf8");

  return JSON.parse(decoded) as Record<string, unknown>;
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const bufferFromBase64Url = (value: string) => Buffer.from(normalizeBase64Url(value), "base64");

const decodeJwtWithoutVerification = (token: string): VerifiedAccessToken => {
  const segments = token.split(".");

  if (segments.length !== 3) {
    throw createAuthError(401, "INVALID_TOKEN", "Invalid access token.");
  }

  const payload = decodeBase64UrlJson(segments[1]);

  if (typeof payload.sub !== "string") {
    throw createAuthError(401, "INVALID_TOKEN", "Invalid access token.");
  }

  return payload as VerifiedAccessToken;
};

export const signAccessToken = (
  claims: Pick<VerifiedAccessToken, "sub"> & Partial<VerifiedAccessToken>,
  secret: string,
  expiresInSeconds = 60 * 60
) => {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + expiresInSeconds
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${input}.${signature}`;
};

export const readBearerToken = (authorizationHeader: string | undefined): string => {
  if (!authorizationHeader) {
    throw createAuthError(401, "UNAUTHORIZED", "Authorization header is required.");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw createAuthError(401, "UNAUTHORIZED", "Authorization header must use the Bearer scheme.");
  }

  return token;
};

export const verifyAccessToken = (token: string, secret: string): VerifiedAccessToken => {
  const segments = token.split(".");

  if (segments.length !== 3) {
    throw createAuthError(401, "INVALID_TOKEN", "Invalid access token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeBase64UrlJson(encodedHeader);

  if (header.alg !== "HS256") {
    throw createAuthError(401, "INVALID_TOKEN", "Unsupported token algorithm.");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSignature = bufferFromBase64Url(encodedSignature);

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw createAuthError(401, "INVALID_TOKEN", "Invalid access token signature.");
  }

  const payload = decodeBase64UrlJson(encodedPayload) as VerifiedAccessToken;

  if (typeof payload.sub !== "string") {
    throw createAuthError(401, "INVALID_TOKEN", "Invalid access token.");
  }

  if (typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw createAuthError(401, "INVALID_TOKEN", "Access token has expired.");
  }

  return payload;
};

const toAuthSession = (
  payload: SupabaseSessionResponse,
  provider: AuthSession["provider"]
): AuthSession => {
  if (!payload.access_token || !payload.refresh_token) {
    throw createAuthError(502, "AUTH_PROVIDER_ERROR", "Auth provider did not return session tokens.");
  }

  const claims = decodeJwtWithoutVerification(payload.access_token);
  const userId = payload.user?.id ?? claims.sub;
  const email = payload.user?.email ?? (typeof claims.email === "string" ? claims.email : undefined);

  if (!userId || !email) {
    throw createAuthError(502, "AUTH_PROVIDER_ERROR", "Auth provider did not return a complete user identity.");
  }

  return {
    userId,
    email,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    provider
  };
};

const mapProviderError = async (response: Response) => {
  let message = "Auth provider request failed.";

  try {
    const payload = (await response.json()) as SupabaseSessionResponse;
    message = payload.error_description ?? payload.msg ?? message;
  } catch {
    // Keep the fallback message when the provider response is not JSON.
  }

  if (response.status === 400) {
    throw createAuthError(400, "AUTH_REQUEST_FAILED", message);
  }

  if (response.status === 401) {
    throw createAuthError(401, "AUTH_INVALID_CREDENTIALS", message);
  }

  if (response.status === 422) {
    throw createAuthError(400, "AUTH_REQUEST_FAILED", message);
  }

  if (response.status === 429) {
    throw createAuthError(429, "AUTH_RATE_LIMITED", message);
  }

  throw createAuthError(502, "AUTH_PROVIDER_ERROR", message);
};

const postSupabase = async (
  config: ApiConfig,
  path: string,
  body: Record<string, unknown>,
  accessToken?: string
) => {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: config.supabaseServiceKey,
      authorization: `Bearer ${accessToken ?? config.supabaseServiceKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    await mapProviderError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as SupabaseSessionResponse;
};

export const createSupabaseAuthProvider = (config: ApiConfig): AuthProvider => ({
  register: async (credentials) => {
    const payload = await postSupabase(config, "/auth/v1/signup", {
      email: credentials.email,
      password: credentials.password,
      data: {
        username: credentials.username
      }
    });

    return toAuthSession(payload ?? {}, "password");
  },
  login: async (credentials) => {
    const payload = await postSupabase(config, "/auth/v1/token?grant_type=password", {
      email: credentials.email,
      password: credentials.password
    });

    return toAuthSession(payload ?? {}, "password");
  },
  logout: async (request) => {
    await postSupabase(
      config,
      "/auth/v1/logout",
      {
        refresh_token: request.refreshToken
      },
      request.accessToken
    );
  },
  refresh: async (request) => {
    const payload = await postSupabase(config, "/auth/v1/token?grant_type=refresh_token", {
      refresh_token: request.refreshToken
    });

    return toAuthSession(payload ?? {}, "password");
  },
  exchangeOAuth: async (request) => {
    if (request.code) {
      const payload = await postSupabase(config, "/auth/v1/token?grant_type=pkce", {
        auth_code: request.code,
        code_verifier: request.codeVerifier,
        redirect_to: request.redirectUri
      });

      return toAuthSession(payload ?? {}, request.provider);
    }

    if (!request.token) {
      throw createAuthError(400, "VALIDATION_ERROR", "OAuth requests require either a code or token.");
    }

    const payload = await postSupabase(config, "/auth/v1/token?grant_type=id_token", {
      provider: request.provider,
      token: request.token,
      access_token: request.accessToken,
      nonce: request.nonce
    });

    return toAuthSession(payload ?? {}, request.provider);
  }
});
