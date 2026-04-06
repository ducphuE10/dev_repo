import { mobileEnvironmentContract, parseEnvironment } from "@dupe-hunt/config";
import type {
  ApiAuthResponse,
  ApiCategoryListResponse,
  ApiCurrentUserResponse,
  ApiFeedResponse,
  ApiMediaUploadResponse,
  ApiPostListResponse,
  ApiPostMediaType,
  ApiPostResponse,
  ApiPublicUserResponse,
  ApiUserCategoryListResponse,
  FeedTab
} from "@dupe-hunt/types";

const mobileEnvironment = parseEnvironment(mobileEnvironmentContract, process.env);

interface ApiClientOptions {
  accessToken?: string | null;
}

interface RequestOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const buildUrl = (path: string) => `${trimTrailingSlash(mobileEnvironment.EXPO_PUBLIC_API_URL)}${path}`;

class MobileApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    };

    if (this.options.accessToken) {
      headers.Authorization = `Bearer ${this.options.accessToken}`;
    }

    const response = await fetch(buildUrl(path), {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers,
      method: options.method ?? "GET"
    });

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const payload = (await response.json()) as TResponse | ApiErrorResponse;

    if (!response.ok) {
      const errorPayload = payload as ApiErrorResponse;
      throw new Error(errorPayload.error?.message ?? `Request failed with status ${response.status}.`);
    }

    return payload as TResponse;
  }

  listCategories() {
    return this.request<ApiCategoryListResponse>("/categories");
  }

  register(input: { email: string; password: string; username: string }) {
    return this.request<ApiAuthResponse>("/auth/register", {
      method: "POST",
      body: input
    });
  }

  login(input: { email: string; password: string }) {
    return this.request<ApiAuthResponse>("/auth/login", {
      method: "POST",
      body: input
    });
  }

  logout(refreshToken: string) {
    return this.request<void>("/auth/logout", {
      method: "POST",
      body: {
        refresh_token: refreshToken
      }
    });
  }

  refresh(refreshToken: string) {
    return this.request<ApiAuthResponse>("/auth/refresh", {
      method: "POST",
      body: {
        refresh_token: refreshToken
      }
    });
  }

  getCurrentUser() {
    return this.request<ApiCurrentUserResponse>("/users/me");
  }

  updateCurrentUser(input: { username?: string; bio?: string | null; avatar_url?: string | null }) {
    return this.request<ApiCurrentUserResponse>("/users/me", {
      method: "PATCH",
      body: input
    });
  }

  listUserCategories() {
    return this.request<ApiUserCategoryListResponse>("/users/me/categories");
  }

  replaceUserCategories(categoryIds: number[]) {
    return this.request<ApiUserCategoryListResponse>("/users/me/categories", {
      method: "PUT",
      body: {
        category_ids: categoryIds
      }
    });
  }

  listSavedPosts() {
    return this.request<ApiPostListResponse>("/users/me/saves");
  }

  getPublicUser(userId: string) {
    return this.request<ApiPublicUserResponse>(`/users/${userId}`);
  }

  followUser(userId: string) {
    return this.request<void>(`/users/${userId}/follow`, {
      method: "POST"
    });
  }

  unfollowUser(userId: string) {
    return this.request<void>(`/users/${userId}/follow`, {
      method: "DELETE"
    });
  }

  requestMediaUpload(input: { media_type: ApiPostMediaType; content_type: string; file_name?: string }) {
    return this.request<ApiMediaUploadResponse>("/upload/media", {
      method: "POST",
      body: input
    });
  }

  createPost(input: {
    category_id: number;
    original_product_name: string;
    original_brand?: string;
    original_price: number;
    original_currency: string;
    dupe_product_name: string;
    dupe_brand?: string;
    dupe_price: number;
    dupe_currency: string;
    media_type: ApiPostMediaType;
    media_urls: string[];
    review_text?: string;
    affiliate_link?: string;
  }) {
    return this.request<ApiPostResponse>("/posts", {
      method: "POST",
      body: input
    });
  }

  listFeed(input: { tab: FeedTab; limit?: number; cursor?: string; categorySlug?: string | null }) {
    const searchParams = new URLSearchParams({
      tab: input.tab,
      limit: String(input.limit ?? 10)
    });

    if (input.cursor) {
      searchParams.set("cursor", input.cursor);
    }

    if (input.categorySlug) {
      searchParams.set("category", input.categorySlug);
    }

    return this.request<ApiFeedResponse>(`/posts?${searchParams.toString()}`);
  }

  getPost(postId: string) {
    return this.request<ApiPostResponse>(`/posts/${postId}`);
  }

  upvotePost(postId: string) {
    return this.request<ApiPostResponse>(`/posts/${postId}/upvote`, {
      method: "POST"
    });
  }

  removeUpvote(postId: string) {
    return this.request<void>(`/posts/${postId}/upvote`, {
      method: "DELETE"
    });
  }

  downvotePost(postId: string) {
    return this.request<ApiPostResponse>(`/posts/${postId}/downvote`, {
      method: "POST"
    });
  }

  removeDownvote(postId: string) {
    return this.request<void>(`/posts/${postId}/downvote`, {
      method: "DELETE"
    });
  }

  savePost(postId: string) {
    return this.request<ApiPostResponse>(`/posts/${postId}/save`, {
      method: "POST"
    });
  }

  removeSavedPost(postId: string) {
    return this.request<void>(`/posts/${postId}/save`, {
      method: "DELETE"
    });
  }
}

export const createApiClient = (options: ApiClientOptions = {}) => new MobileApiClient(options);

export const mobileAppShell = {
  apiBaseUrl: mobileEnvironment.EXPO_PUBLIC_API_URL,
  supabaseUrl: mobileEnvironment.EXPO_PUBLIC_SUPABASE_URL,
  hasSupabaseAnonKey: mobileEnvironment.EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 0
} as const;
