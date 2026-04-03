CREATE TABLE IF NOT EXISTS user_categories (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (user_id, category_id)
);
