CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  original_product_name VARCHAR(100) NOT NULL,
  original_brand VARCHAR(100),
  original_price DECIMAL(10, 2),
  original_currency CHAR(3) NOT NULL DEFAULT 'USD',
  dupe_product_name VARCHAR(100) NOT NULL,
  dupe_brand VARCHAR(100),
  dupe_price DECIMAL(10, 2),
  dupe_currency CHAR(3) NOT NULL DEFAULT 'USD',
  price_saved DECIMAL(10, 2) GENERATED ALWAYS AS (original_price - dupe_price) STORED,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('video', 'photo')),
  media_urls JSONB NOT NULL,
  review_text VARCHAR(280),
  affiliate_link TEXT,
  affiliate_platform VARCHAR(50),
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  flag_count INTEGER NOT NULL DEFAULT 0,
  is_verified_buy BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_url TEXT,
  receipt_verified_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'flagged', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_category_id_idx ON posts(category_id);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_upvote_count_idx ON posts(upvote_count DESC);
CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
CREATE INDEX IF NOT EXISTS posts_is_verified_idx ON posts(is_verified_buy);
