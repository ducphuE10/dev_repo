import type { DatabaseClient } from "@dupe-hunt/db";

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

const toIsoString = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

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

export const createDatabaseRepository = (database: DatabaseClient): ApiRepository => ({
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

    return (await database.sql<CategoryRow[]>`
      SELECT c.${database.sql.unsafe(categorySelection)}
      FROM user_categories uc
      INNER JOIN categories c ON c.id = uc.category_id
      WHERE uc.user_id = ${userId}
        AND c.is_active = TRUE
      ORDER BY c.sort_order ASC, c.name ASC
    `).map(mapCategoryRow);
  }
});
