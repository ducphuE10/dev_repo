import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const contributorTierValues = ["standard", "top_contributor"] as const;
export const mediaTypeValues = ["video", "photo"] as const;
export const postStatusValues = ["active", "flagged", "removed"] as const;
export const flagReasonValues = ["spam", "fake", "inappropriate", "affiliate_abuse"] as const;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  avatarUrl: text("avatar_url"),
  bio: varchar("bio", { length: 160 }),
  verifiedBuyCount: integer("verified_buy_count").notNull().default(0),
  totalUpvotes: integer("total_upvotes").notNull().default(0),
  contributorTier: varchar("contributor_tier", {
    length: 20,
    enum: contributorTierValues
  })
    .notNull()
    .default("standard"),
  postsPerDayCount: integer("posts_per_day_count").notNull().default(0),
  lastPostDate: date("last_post_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow()
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  icon: varchar("icon", { length: 10 }),
  postCount: integer("post_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true)
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    originalProductName: varchar("original_product_name", { length: 100 }).notNull(),
    originalBrand: varchar("original_brand", { length: 100 }),
    originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
    originalCurrency: char("original_currency", { length: 3 }).notNull().default("USD"),
    dupeProductName: varchar("dupe_product_name", { length: 100 }).notNull(),
    dupeBrand: varchar("dupe_brand", { length: 100 }),
    dupePrice: numeric("dupe_price", { precision: 10, scale: 2 }),
    dupeCurrency: char("dupe_currency", { length: 3 }).notNull().default("USD"),
    priceSaved: numeric("price_saved", { precision: 10, scale: 2 }),
    mediaType: varchar("media_type", { length: 10, enum: mediaTypeValues }).notNull(),
    mediaUrls: jsonb("media_urls").$type<string[]>().notNull(),
    reviewText: varchar("review_text", { length: 280 }),
    affiliateLink: text("affiliate_link"),
    affiliatePlatform: varchar("affiliate_platform", { length: 50 }),
    upvoteCount: integer("upvote_count").notNull().default(0),
    downvoteCount: integer("downvote_count").notNull().default(0),
    flagCount: integer("flag_count").notNull().default(0),
    isVerifiedBuy: boolean("is_verified_buy").notNull().default(false),
    receiptUrl: text("receipt_url"),
    receiptVerifiedAt: timestamp("receipt_verified_at", { withTimezone: true }),
    status: varchar("status", { length: 20, enum: postStatusValues }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    categoryIdIdx: index("posts_category_id_idx").on(table.categoryId),
    userIdIdx: index("posts_user_id_idx").on(table.userId),
    createdAtIdx: index("posts_created_at_idx").on(table.createdAt),
    upvoteCountIdx: index("posts_upvote_count_idx").on(table.upvoteCount),
    statusIdx: index("posts_status_idx").on(table.status),
    verifiedIdx: index("posts_is_verified_idx").on(table.isVerifiedBuy)
  })
);

export const upvotes = pgTable(
  "upvotes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.postId] }),
    postIdIdx: index("upvotes_post_id_idx").on(table.postId)
  })
);

export const downvotes = pgTable(
  "downvotes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.postId] }),
    postIdIdx: index("downvotes_post_id_idx").on(table.postId)
  })
);

export const flags = pgTable(
  "flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 50, enum: flagReasonValues }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userPostIdx: uniqueIndex("flags_user_post_idx").on(table.userId, table.postId),
    postIdIdx: index("flags_post_id_idx").on(table.postId)
  })
);

export const saves = pgTable(
  "saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.postId] })
  })
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followingId] })
  })
);

export const userCategories = pgTable(
  "user_categories",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.categoryId] })
  })
);

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 100 }),
    affiliatePlatform: varchar("affiliate_platform", { length: 50 }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    commissionAmount: numeric("commission_amount", { precision: 10, scale: 4 })
  },
  (table) => ({
    postIdIdx: index("affiliate_clicks_post_id_idx").on(table.postId),
    clickedAtIdx: index("affiliate_clicks_clicked_at_idx").on(table.clickedAt)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  upvotes: many(upvotes),
  downvotes: many(downvotes),
  flags: many(flags),
  saves: many(saves),
  followerLinks: many(follows, { relationName: "followers" }),
  followingLinks: many(follows, { relationName: "following" }),
  categoryPreferences: many(userCategories),
  affiliateClicks: many(affiliateClicks)
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
  userCategories: many(userCategories)
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id]
  }),
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id]
  }),
  upvotes: many(upvotes),
  downvotes: many(downvotes),
  flags: many(flags),
  saves: many(saves),
  affiliateClicks: many(affiliateClicks)
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id]
  }),
  post: one(posts, {
    fields: [upvotes.postId],
    references: [posts.id]
  })
}));

export const downvotesRelations = relations(downvotes, ({ one }) => ({
  user: one(users, {
    fields: [downvotes.userId],
    references: [users.id]
  }),
  post: one(posts, {
    fields: [downvotes.postId],
    references: [posts.id]
  })
}));

export const flagsRelations = relations(flags, ({ one }) => ({
  user: one(users, {
    fields: [flags.userId],
    references: [users.id]
  }),
  post: one(posts, {
    fields: [flags.postId],
    references: [posts.id]
  })
}));

export const savesRelations = relations(saves, ({ one }) => ({
  user: one(users, {
    fields: [saves.userId],
    references: [users.id]
  }),
  post: one(posts, {
    fields: [saves.postId],
    references: [posts.id]
  })
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "followers"
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following"
  })
}));

export const userCategoriesRelations = relations(userCategories, ({ one }) => ({
  user: one(users, {
    fields: [userCategories.userId],
    references: [users.id]
  }),
  category: one(categories, {
    fields: [userCategories.categoryId],
    references: [categories.id]
  })
}));

export const affiliateClicksRelations = relations(affiliateClicks, ({ one }) => ({
  post: one(posts, {
    fields: [affiliateClicks.postId],
    references: [posts.id]
  }),
  user: one(users, {
    fields: [affiliateClicks.userId],
    references: [users.id]
  })
}));

export const schema = {
  users,
  categories,
  posts,
  upvotes,
  downvotes,
  flags,
  saves,
  follows,
  userCategories,
  affiliateClicks
} as const;
