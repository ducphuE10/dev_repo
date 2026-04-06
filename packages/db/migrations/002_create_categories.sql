CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(10),
  post_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO categories (name, slug, icon, sort_order)
VALUES
  ('Beauty & Skincare', 'beauty', '💄', 1),
  ('Fashion & Clothing', 'fashion', '👗', 2),
  ('Tech Accessories', 'tech', '💻', 3),
  ('Home & Decor', 'home', '🏠', 4),
  ('Food & Drinks', 'food', '🍔', 5)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
