import { notFound } from "next/navigation";

import { CategoryNav } from "../../src/components/CategoryNav.tsx";
import { DownloadAppBanner } from "../../src/components/DownloadAppBanner.tsx";
import { EmptyState } from "../../src/components/EmptyState.tsx";
import { PostCard } from "../../src/components/PostCard.tsx";
import { SearchForm } from "../../src/components/SearchForm.tsx";
import { getCategories, getCategoryBySlug, listFeed } from "../../src/lib/api.ts";
import { createCategoryMetadata } from "../../src/lib/metadata.ts";

const allowedTabs = new Set(["for_you", "trending", "new"]);

const readTab = (value: string | undefined) =>
  value && allowedTabs.has(value) ? (value as "for_you" | "trending" | "new") : "trending";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category } = await params;
  const matchedCategory = await getCategoryBySlug(category);

  if (!matchedCategory) {
    return {
      title: "Category not found | Dupe Hunt"
    };
  }

  return createCategoryMetadata(matchedCategory);
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ category: categorySlug }, { tab: requestedTab }] = await Promise.all([params, searchParams]);
  const tab = readTab(requestedTab);
  try {
    const [categories, category, feed] = await Promise.all([
      getCategories(),
      getCategoryBySlug(categorySlug),
      listFeed({
        tab,
        categorySlug,
        limit: 12
      })
    ]);

    if (!category) {
      notFound();
    }

    return (
      <div className="page-stack">
        <section className="hero-panel hero-panel--compact">
          <p className="eyebrow">{category.name}</p>
          <h1>Browse {category.name.toLowerCase()} dupes with honest prices and creator context.</h1>
          <p className="hero-panel__lede">
            Filtered server-side for SEO, shareable previews, and fast discovery across the Dupe Hunt community.
          </p>
          <SearchForm initialCategory={category.slug} />
        </section>

        <CategoryNav activeSlug={category.slug} categories={categories} />

        <div className="tab-row" role="tablist" aria-label="Browse tabs">
          {[
            ["trending", "Trending"],
            ["new", "Newest"],
            ["for_you", "Top picks"]
          ].map(([value, label]) => (
            <a
              aria-selected={tab === value}
              className={tab === value ? "tab-chip tab-chip--active" : "tab-chip"}
              href={`/${category.slug}?tab=${value}`}
              key={value}
              role="tab"
            >
              {label}
            </a>
          ))}
        </div>

        <DownloadAppBanner />

        {feed.posts.length > 0 ? (
          <section className="post-grid">
            {feed.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </section>
        ) : (
          <EmptyState
            description={`No ${category.name.toLowerCase()} dupes match this tab yet. Check back after the next creator drop.`}
            title="Nothing live in this lane yet"
          />
        )}
      </div>
    );
  } catch {
    const category = await getCategoryBySlug(categorySlug).catch(() => null);

    if (!category) {
      notFound();
    }

    return (
      <div className="page-stack">
        <section className="hero-panel hero-panel--compact">
          <p className="eyebrow">{category.name}</p>
          <h1>Browse {category.name.toLowerCase()} dupes with honest prices and creator context.</h1>
          <p className="hero-panel__lede">This category is temporarily available in fallback mode while live feed data reloads.</p>
          <SearchForm initialCategory={category.slug} />
        </section>
        <DownloadAppBanner />
        <EmptyState
          description={`The ${category.name.toLowerCase()} feed could not load right now. Try again soon or switch to search.`}
          title="Category feed unavailable"
        />
      </div>
    );
  }
}
