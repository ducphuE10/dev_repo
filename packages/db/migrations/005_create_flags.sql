CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL
    CHECK (reason IN ('spam', 'fake', 'inappropriate', 'affiliate_abuse')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS flags_post_id_idx ON flags(post_id);
