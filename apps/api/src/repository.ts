import type { DatabaseClient } from "@dupe-hunt/db";

export type FeedTab = "for_you" | "trending" | "new";
export type PostMediaType = "video" | "photo";
export type PostStatus = "active" | "flagged" | "removed";

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  verifiedBuyCount: number;
  totalUpvotes: number;
  contributorTier: string;
  postsPerDayCount: number;
  lastPostDate: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  postCount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface PostAuthorRecord {
  id: string;
  username: string;
  avatarUrl: string | null;
  verifiedBuyCount: number;
  contributorTier: string;
}

export interface PostRecord {
  id: string;
  userId: string;
  categoryId: number;
  originalProductName: string;
  originalBrand: string | null;
  originalPrice: number | null;
  originalCurrency: string;
  dupeProductName: string;
  dupeBrand: string | null;
  dupePrice: number | null;
  dupeCurrency: string;
  priceSaved: number | null;
  mediaType: PostMediaType;
  mediaUrls: string[];
  reviewText: string | null;
  affiliateLink: string | null;
  affiliatePlatform: string | null;
  upvoteCount: number;
  downvoteCount: number;
  flagCount: number;
  isVerifiedBuy: boolean;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  user: PostAuthorRecord;
  category: CategoryRecord;
}

export interface CreateUserInput {
  id: string;
  username: string;
  email: string;
}

export interface UpdateUserProfileInput {
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface CreatePostInput {
  userId: string;
  categoryId: number;
  originalProductName: string;
  originalBrand?: string;
  originalPrice: number;
  originalCurrency: string;
  dupeProductName: string;
  dupeBrand?: string;
  dupePrice: number;
  dupeCurrency: string;
  mediaType: PostMediaType;
  mediaUrls: string[];
  reviewText?: string;
  affiliateLink?: string;
  affiliatePlatform?: string;
}

export interface FindPostOptions {
  includeInactive?: boolean;
}

export interface ListPostsInput {
  tab: FeedTab;
  categoryIds?: number[];
  verifiedOnly: boolean;
  cursor?: string;
  limit: number;
}

export interface ApiRepository {
  findUserByEmail: (email: string) => Promise<UserRecord | null>;
  findUserById: (id: string) => Promise<UserRecord | null>;
  findUserByUsername: (username: string) => Promise<UserRecord | null>;
  createUser: (input: CreateUserInput) => Promise<UserRecord>;
  updateUserProfile: (userId: string, input: UpdateUserProfileInput) => Promise<UserRecord | null>;
  touchUser: (userId: string) => Promise<void>;
  listActiveCategories: () => Promise<CategoryRecord[]>;
  listUserCategories: (userId: string) => Promise<CategoryRecord[]>;
  replaceUserCategories: (userId: string, categoryIds: number[]) => Promise<CategoryRecord[]>;
  createPost: (input: CreatePostInput) => Promise<PostRecord>;
  findPostById: (postId: string, options?: FindPostOptions) => Promise<PostRecord | null>;
  listPosts: (input: ListPostsInput) => Promise<PostRecord[]>;
  softDeletePost: (postId: string) => Promise<void>;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  verified_buy_count: number;
  total_upvotes: number;
  contributor_tier: string;
  posts_per_day_count: number;
  last_post_date: string | null;
  created_at: Date | string;
  last_active_at: Date | string;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  post_count: number;
  sort_order: number;
  is_active: boolean;
}

interface PostRow {
  id: string;
  user_id: string;
  post_category_id: number;
  original_product_name: string;
  original_brand: string | null;
  original_price: number | string | null;
  original_currency: string;
  dupe_product_name: string;
  dupe_brand: string | null;
  dupe_price: number | string | null;
  dupe_currency: string;
  price_saved: number | string | null;
  media_type: PostMediaType;
  media_urls: string[];
  review_text: string | null;
  affiliate_link: string | null;
  affiliate_platform: string | null;
  upvote_count: number;
  downvote_count: number;
  flag_count: number;
  is_verified_buy: boolean;
  status: PostStatus;
  created_at: Date | string;
  updated_at: Date | string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_verified_buy_count: number;
  author_contributor_tier: string;
  category_record_id: number;
  category_name: string;
  category_slug: string;
  category_icon: string | null;
  category_post_count: number;
  category_sort_order: number;
  category_is_active: boolean;
}

const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

const toIsoString = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

const toNullableNumber = (value: number | string | null) => {
  if (value === null) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
};

const compareDescendingString = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
};

const isRecentPost = (createdAt: string) => Date.parse(createdAt) >= Date.now() - oneDayInMilliseconds;

const scoreForYouPost = (post: PostRecord) =>
  post.upvoteCount + (post.isVerifiedBuy ? 10 : 0) + (isRecentPost(post.createdAt) ? 5 : 0);

const sortPosts = (posts: PostRecord[], tab: FeedTab) =>
  [...posts].sort((left, right) => {
    if (tab === "for_you") {
      const leftScore = scoreForYouPost(left);
      const rightScore = scoreForYouPost(right);

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
    }

    if (tab === "trending") {
      if (left.upvoteCount !== right.upvoteCount) {
        return right.upvoteCount - left.upvoteCount;
      }
    }

    const createdAtDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return compareDescendingString(left.id, right.id);
  });

const mapUserRow = (row: UserRow): UserRecord => ({
  id: row.id,
  username: row.username,
  email: row.email,
  avatarUrl: row.avatar_url,
  bio: row.bio,
  verifiedBuyCount: row.verified_buy_count,
  totalUpvotes: row.total_upvotes,
  contributorTier: row.contributor_tier,
  postsPerDayCount: row.posts_per_day_count,
  lastPostDate: row.last_post_date,
  createdAt: toIsoString(row.created_at),
  lastActiveAt: toIsoString(row.last_active_at)
});

const mapCategoryRow = (row: CategoryRow): CategoryRecord => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  icon: row.icon,
  postCount: row.post_count,
  sortOrder: row.sort_order,
  isActive: row.is_active
});

const mapPostRow = (row: PostRow): PostRecord => ({
  id: row.id,
  userId: row.user_id,
  categoryId: row.post_category_id,
  originalProductName: row.original_product_name,
  originalBrand: row.original_brand,
  originalPrice: toNullableNumber(row.original_price),
  originalCurrency: row.original_currency,
  dupeProductName: row.dupe_product_name,
  dupeBrand: row.dupe_brand,
  dupePrice: toNullableNumber(row.dupe_price),
  dupeCurrency: row.dupe_currency,
  priceSaved: toNullableNumber(row.price_saved),
  mediaType: row.media_type,
  mediaUrls: row.media_urls,
  reviewText: row.review_text,
  affiliateLink: row.affiliate_link,
  affiliatePlatform: row.affiliate_platform,
  upvoteCount: row.upvote_count,
  downvoteCount: row.downvote_count,
  flagCount: row.flag_count,
  isVerifiedBuy: row.is_verified_buy,
  status: row.status,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  user: {
    id: row.author_id,
    username: row.author_username,
    avatarUrl: row.author_avatar_url,
    verifiedBuyCount: row.author_verified_buy_count,
    contributorTier: row.author_contributor_tier
  },
  category: {
    id: row.category_record_id,
    name: row.category_name,
    slug: row.category_slug,
    icon: row.category_icon,
    postCount: row.category_post_count,
    sortOrder: row.category_sort_order,
    isActive: row.category_is_active
  }
});

const userSelection = `
  id,
  username,
  email,
  avatar_url,
  bio,
  verified_buy_count,
  total_upvotes,
  contributor_tier,
  posts_per_day_count,
  last_post_date,
  created_at,
  last_active_at
`;

const categorySelection = `
  id,
  name,
  slug,
  icon,
  post_count,
  sort_order,
  is_active
`;

const postSelection = `
  p.id,
  p.user_id,
  p.category_id AS post_category_id,
  p.original_product_name,
  p.original_brand,
  p.original_price,
  p.original_currency,
  p.dupe_product_name,
  p.dupe_brand,
  p.dupe_price,
  p.dupe_currency,
  p.price_saved,
  p.media_type,
  p.media_urls,
  p.review_text,
  p.affiliate_link,
  p.affiliate_platform,
  p.upvote_count,
  p.downvote_count,
  p.flag_count,
  p.is_verified_buy,
  p.status,
  p.created_at,
  p.updated_at,
  u.id AS author_id,
  u.username AS author_username,
  u.avatar_url AS author_avatar_url,
  u.verified_buy_count AS author_verified_buy_count,
  u.contributor_tier AS author_contributor_tier,
  c.id AS category_record_id,
  c.name AS category_name,
  c.slug AS category_slug,
  c.icon AS category_icon,
  c.post_count AS category_post_count,
  c.sort_order AS category_sort_order,
  c.is_active AS category_is_active
`;

export const createDatabaseRepository = (database: DatabaseClient): ApiRepository => {
  const readActivePostRows = async () =>
    database.sql<PostRow[]>`
      SELECT ${database.sql.unsafe(postSelection)}
      FROM posts p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
        AND c.is_active = TRUE
    `;

  return {
    findUserByEmail: async (email) => {
      const rows = await database.sql<UserRow[]>`
        SELECT ${database.sql.unsafe(userSelection)}
        FROM users
        WHERE LOWER(email) = LOWER(${email})
        LIMIT 1
      `;

      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    findUserById: async (id) => {
      const rows = await database.sql<UserRow[]>`
        SELECT ${database.sql.unsafe(userSelection)}
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;

      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    findUserByUsername: async (username) => {
      const rows = await database.sql<UserRow[]>`
        SELECT ${database.sql.unsafe(userSelection)}
        FROM users
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1
      `;

      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    createUser: async (input) => {
      const rows = await database.sql<UserRow[]>`
        INSERT INTO users (id, username, email)
        VALUES (${input.id}, ${input.username}, ${input.email})
        RETURNING ${database.sql.unsafe(userSelection)}
      `;

      return mapUserRow(rows[0]);
    },
    updateUserProfile: async (userId, input) => {
      const rows = await database.sql<UserRow[]>`
        UPDATE users
        SET
          username = COALESCE(${input.username ?? null}, username),
          bio = COALESCE(${input.bio ?? null}, bio),
          avatar_url = COALESCE(${input.avatarUrl ?? null}, avatar_url),
          last_active_at = NOW()
        WHERE id = ${userId}
        RETURNING ${database.sql.unsafe(userSelection)}
      `;

      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    touchUser: async (userId) => {
      await database.sql`
        UPDATE users
        SET last_active_at = NOW()
        WHERE id = ${userId}
      `;
    },
    listActiveCategories: async () => {
      const rows = await database.sql<CategoryRow[]>`
        SELECT ${database.sql.unsafe(categorySelection)}
        FROM categories
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, name ASC
      `;

      return rows.map(mapCategoryRow);
    },
    listUserCategories: async (userId) => {
      const rows = await database.sql<CategoryRow[]>`
        SELECT c.${database.sql.unsafe(categorySelection)}
        FROM user_categories uc
        INNER JOIN categories c ON c.id = uc.category_id
        WHERE uc.user_id = ${userId}
          AND c.is_active = TRUE
        ORDER BY c.sort_order ASC, c.name ASC
      `;

      return rows.map(mapCategoryRow);
    },
    replaceUserCategories: async (userId, categoryIds) => {
      const uniqueCategoryIds = Array.from(new Set(categoryIds));

      await database.sql`
        DELETE FROM user_categories
        WHERE user_id = ${userId}
      `;

      for (const categoryId of uniqueCategoryIds) {
        await database.sql`
          INSERT INTO user_categories (user_id, category_id)
          VALUES (${userId}, ${categoryId})
        `;
      }

      return (
        await database.sql<CategoryRow[]>`
          SELECT c.${database.sql.unsafe(categorySelection)}
          FROM user_categories uc
          INNER JOIN categories c ON c.id = uc.category_id
          WHERE uc.user_id = ${userId}
            AND c.is_active = TRUE
          ORDER BY c.sort_order ASC, c.name ASC
        `
      ).map(mapCategoryRow);
    },
    createPost: async (input) => {
      const insertedRows = await database.sql<{ id: string }[]>`
        INSERT INTO posts (
          user_id,
          category_id,
          original_product_name,
          original_brand,
          original_price,
          original_currency,
          dupe_product_name,
          dupe_brand,
          dupe_price,
          dupe_currency,
          media_type,
          media_urls,
          review_text,
          affiliate_link,
          affiliate_platform
        )
        VALUES (
          ${input.userId},
          ${input.categoryId},
          ${input.originalProductName},
          ${input.originalBrand ?? null},
          ${input.originalPrice},
          ${input.originalCurrency},
          ${input.dupeProductName},
          ${input.dupeBrand ?? null},
          ${input.dupePrice},
          ${input.dupeCurrency},
          ${input.mediaType},
          ${database.sql.json(input.mediaUrls)},
          ${input.reviewText ?? null},
          ${input.affiliateLink ?? null},
          ${input.affiliatePlatform ?? null}
        )
        RETURNING id
      `;

      await database.sql`
        UPDATE users
        SET
          posts_per_day_count = CASE
            WHEN last_post_date = CURRENT_DATE THEN posts_per_day_count + 1
            ELSE 1
          END,
          last_post_date = CURRENT_DATE,
          last_active_at = NOW()
        WHERE id = ${input.userId}
      `;

      await database.sql`
        UPDATE categories
        SET post_count = post_count + 1
        WHERE id = ${input.categoryId}
      `;

      const post = await readActivePostRows().then((rows) =>
        rows.map(mapPostRow).find((candidate) => candidate.id === insertedRows[0]?.id) ?? null
      );

      if (!post) {
        throw new Error("Created post could not be read back.");
      }

      return post;
    },
    findPostById: async (postId, options = {}) => {
      const rows = options.includeInactive
        ? await database.sql<PostRow[]>`
            SELECT ${database.sql.unsafe(postSelection)}
            FROM posts p
            INNER JOIN users u ON u.id = p.user_id
            INNER JOIN categories c ON c.id = p.category_id
            WHERE p.id = ${postId}
            LIMIT 1
          `
        : await database.sql<PostRow[]>`
            SELECT ${database.sql.unsafe(postSelection)}
            FROM posts p
            INNER JOIN users u ON u.id = p.user_id
            INNER JOIN categories c ON c.id = p.category_id
            WHERE p.id = ${postId}
              AND p.status = 'active'
              AND c.is_active = TRUE
            LIMIT 1
          `;

      return rows[0] ? mapPostRow(rows[0]) : null;
    },
    listPosts: async (input) => {
      const categoryIds = input.categoryIds ? Array.from(new Set(input.categoryIds)) : undefined;

      if (categoryIds && categoryIds.length === 0) {
        return [];
      }

      const filtered = (await readActivePostRows())
        .map(mapPostRow)
        .filter((post) => {
          if (input.tab === "trending" && !isRecentPost(post.createdAt)) {
            return false;
          }

          if (input.verifiedOnly && !post.isVerifiedBuy) {
            return false;
          }

          if (categoryIds && !categoryIds.includes(post.categoryId)) {
            return false;
          }

          return true;
        });

      const sorted = sortPosts(filtered, input.tab);

      if (!input.cursor) {
        return sorted.slice(0, input.limit);
      }

      const cursorIndex = sorted.findIndex((post) => post.id === input.cursor);

      if (cursorIndex === -1) {
        return [];
      }

      return sorted.slice(cursorIndex + 1, cursorIndex + 1 + input.limit);
    },
    softDeletePost: async (postId) => {
      const rows = await database.sql<{ category_id: number }[]>`
        UPDATE posts
        SET
          status = 'removed',
          updated_at = NOW()
        WHERE id = ${postId}
          AND status <> 'removed'
        RETURNING category_id
      `;

      const categoryId = rows[0]?.category_id;

      if (categoryId) {
        await database.sql`
          UPDATE categories
          SET post_count = GREATEST(post_count - 1, 0)
          WHERE id = ${categoryId}
        `;
      }
    }
  };
};
