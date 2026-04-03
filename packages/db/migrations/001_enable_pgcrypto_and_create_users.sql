CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  bio VARCHAR(160),
  verified_buy_count INTEGER NOT NULL DEFAULT 0,
  total_upvotes INTEGER NOT NULL DEFAULT 0,
  contributor_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (contributor_tier IN ('standard', 'top_contributor')),
  posts_per_day_count INTEGER NOT NULL DEFAULT 0,
  last_post_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
