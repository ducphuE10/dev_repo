export type WorkspaceStatus = "scaffolded";

export type WorkspaceAppName = "api" | "web" | "mobile";
export type FeedTab = "for_you" | "trending" | "new";
export type ApiPostMediaType = "photo" | "video";

export type WorkspacePackageName =
  | "@dupe-hunt/api"
  | "@dupe-hunt/web"
  | "@dupe-hunt/mobile"
  | "@dupe-hunt/config"
  | "@dupe-hunt/types"
  | "@dupe-hunt/db";

export type NodeEnvironment = "development" | "test" | "production";

export interface WorkspaceDescriptor {
  name: WorkspacePackageName;
  status: WorkspaceStatus;
}

export interface ApiPublicUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  verified_buy_count: number;
  total_upvotes: number;
  contributor_tier: string;
  created_at: string;
  last_active_at: string;
}

export interface ApiCurrentUser extends ApiPublicUser {
  email: string;
  last_post_date: string | null;
  posts_per_day_count: number;
}

export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  post_count: number;
  sort_order: number;
}

export interface ApiPost {
  id: string;
  original_product_name: string;
  original_brand: string | null;
  original_price: number | null;
  original_currency: string;
  dupe_product_name: string;
  dupe_brand: string | null;
  dupe_price: number | null;
  dupe_currency: string;
  price_saved: number | null;
  media_type: ApiPostMediaType;
  media_urls: string[];
  review_text: string | null;
  affiliate_link: string | null;
  affiliate_platform: string | null;
  upvote_count: number;
  downvote_count: number;
  flag_count: number;
  is_verified_buy: boolean;
  status: "active" | "flagged" | "removed";
  created_at: string;
  updated_at: string;
  user: ApiPublicUser;
  category: ApiCategory;
}

export interface ApiCategoryListResponse {
  categories: ApiCategory[];
}

export interface ApiUserCategoryListResponse {
  categories: ApiCategory[];
}

export interface ApiCurrentUserResponse {
  user: ApiCurrentUser;
}

export interface ApiPublicUserResponse {
  user: ApiPublicUser;
}

export interface ApiAuthResponse {
  user: {
    id: string;
    username: string;
  };
  token: string;
  refresh_token: string;
}

export interface ApiFeedResponse {
  posts: ApiPost[];
  next_cursor: string | null;
}

export interface ApiPostResponse {
  post: ApiPost;
}

export interface ApiPostListResponse {
  posts: ApiPost[];
}

export interface ApiTrendingSearchTerm {
  term: string;
  search_count: number;
}

export interface ApiTrendingSearchResponse {
  terms: ApiTrendingSearchTerm[];
}

export interface ApiMediaUploadResponse {
  upload_url: string;
  media_url: string;
  expires_in: number;
}

export interface EnvironmentVariableSpec {
  key: string;
  required: boolean;
  description: string;
  example: string;
}

export interface EnvironmentContract<
  TVariables extends readonly EnvironmentVariableSpec[] = readonly EnvironmentVariableSpec[]
> {
  app: WorkspaceAppName;
  envFile: ".env";
  exampleFile: ".env.example";
  variables: TVariables;
}

export type ParsedEnvironment<TContract extends EnvironmentContract> = {
  [TKey in TContract["variables"][number]["key"]]: string;
};

export const workspacePackageNames = {
  api: "@dupe-hunt/api",
  web: "@dupe-hunt/web",
  mobile: "@dupe-hunt/mobile",
  config: "@dupe-hunt/config",
  types: "@dupe-hunt/types",
  db: "@dupe-hunt/db"
} as const;
