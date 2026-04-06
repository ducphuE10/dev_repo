import Link from "next/link";

import type { ApiCategory } from "@dupe-hunt/types";

interface CategoryNavProps {
  categories: ApiCategory[];
  activeSlug?: string | null;
}

export const CategoryNav = ({ categories, activeSlug }: CategoryNavProps) => (
  <nav className="category-nav" aria-label="Categories">
    <Link className={!activeSlug ? "category-pill category-pill--active" : "category-pill"} href="/">
      All
    </Link>
    {categories.map((category) => (
      <Link
        key={category.id}
        className={category.slug === activeSlug ? "category-pill category-pill--active" : "category-pill"}
        href={`/${category.slug}`}
      >
        <span aria-hidden="true">{category.icon ?? "#"}</span>
        {category.name}
      </Link>
    ))}
  </nav>
);
