import Link from "next/link";

import { CategoryNav } from "../../src/components/CategoryNav.tsx";
import { DownloadAppBanner } from "../../src/components/DownloadAppBanner.tsx";
import { EmptyState } from "../../src/components/EmptyState.tsx";
import { PostCard } from "../../src/components/PostCard.tsx";
import { SearchForm } from "../../src/components/SearchForm.tsx";
import { getCategories, getTrendingSearchTerms, searchPosts } from "../../src/lib/api.ts";
import { createSearchMetadata } from "../../src/lib/metadata.ts";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    verified?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  return createSearchMetadata(q?.trim() || null);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", category = "", sort = "upvotes", verified } = await searchParams;
  const query = q.trim();
  const verifiedOnly = verified === "true";

  const [categories, trendingTerms, searchResponse] = await Promise.all([
    getCategories(),
    getTrendingSearchTerms(10),
    query
      ? searchPosts({
          query,
          categorySlug: category || null,
          verifiedOnly,
          sort: sort === "newest" ? "newest" : "upvotes",
          limit: 24
        })
      : Promise.resolve(null)
  ]);

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel--compact">
        <p className="eyebrow">Search the community</p>
        <h1>Find dupes by product name, brand, category, or what everyone keeps typing.</h1>
        <p className="hero-panel__lede">
          This page is server-rendered so searches can turn into indexable landing pages when a dupe starts to trend.
        </p>
        <SearchForm
          initialCategory={category}
          initialQuery={query}
          initialSort={sort === "newest" ? "newest" : "upvotes"}
          verifiedOnly={verifiedOnly}
        />
      </section>

      <CategoryNav activeSlug={category || null} categories={categories} />
      <DownloadAppBanner />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{query ? "Results" : "Trending searches"}</p>
            <h2>{query ? `Search results for "${query}"` : "What people are hunting for right now"}</h2>
          </div>
        </div>

        {!query ? (
          <div className="trending-search-grid">
            {trendingTerms.map((term) => (
              <Link href={`/search?q=${encodeURIComponent(term.term)}`} key={term.term}>
                <strong>{term.term}</strong>
                <span>{term.search_count} searches</span>
              </Link>
            ))}
          </div>
        ) : searchResponse && searchResponse.posts.length > 0 ? (
          <div className="post-grid">
            {searchResponse.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Try another product name, remove a filter, or browse one of the trending community searches."
            title="No dupes matched this search"
          />
        )}
      </section>
    </div>
  );
}
