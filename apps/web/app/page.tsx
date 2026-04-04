import Link from "next/link";

import { CategoryNav } from "../src/components/CategoryNav.tsx";
import { DownloadAppBanner } from "../src/components/DownloadAppBanner.tsx";
import { EmptyState } from "../src/components/EmptyState.tsx";
import { PostCard } from "../src/components/PostCard.tsx";
import { SearchForm } from "../src/components/SearchForm.tsx";
import { getCategories, getTrendingSearchTerms, listFeed } from "../src/lib/api.ts";
import { createHomeMetadata } from "../src/lib/metadata.ts";

export const dynamic = "force-dynamic";
export const metadata = createHomeMetadata();

export default async function HomePage() {
  const [categories, trendingFeed, newFeed, trendingTerms] = await Promise.all([
    getCategories(),
    listFeed({
      tab: "trending",
      limit: 6
    }),
    listFeed({
      tab: "new",
      limit: 6
    }),
    getTrendingSearchTerms(6)
  ]);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <p className="eyebrow">Verified swaps for expensive favorites</p>
        <h1>The browse layer for honest dupes with proof, pricing, and real creator taste.</h1>
        <p className="hero-panel__lede">
          Dupe Hunt turns community receipts into search-friendly pages. Start with what is trending, then drop into
          category feeds, creator profiles, or a single dupe page to compare the save.
        </p>
        <SearchForm />
        <div className="trending-term-row">
          {trendingTerms.map((term) => (
            <Link href={`/search?q=${encodeURIComponent(term.term)}`} key={term.term}>
              {term.term}
            </Link>
          ))}
        </div>
      </section>

      <CategoryNav activeSlug={null} categories={categories} />
      <DownloadAppBanner />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Trending now</p>
            <h2>Most shared dupes this week</h2>
          </div>
          <Link href="/search">See all searches</Link>
        </div>
        {trendingFeed.posts.length > 0 ? (
          <div className="post-grid">
            {trendingFeed.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Once the first community finds land, the trending feed will surface them here."
            title="Trending dupes are warming up"
          />
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fresh receipts</p>
            <h2>Latest creator-backed discoveries</h2>
          </div>
        </div>
        {newFeed.posts.length > 0 ? (
          <div className="post-grid">
            {newFeed.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="New posts will show up here as soon as the API has live content."
            title="No recent dupes yet"
          />
        )}
      </section>
    </div>
  );
}
