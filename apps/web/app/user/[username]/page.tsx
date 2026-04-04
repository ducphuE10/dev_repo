import { notFound } from "next/navigation";

import { DownloadAppBanner } from "../../../src/components/DownloadAppBanner.tsx";
import { EmptyState } from "../../../src/components/EmptyState.tsx";
import { PostCard } from "../../../src/components/PostCard.tsx";
import { getPublicUserByUsername, listFeed, WebApiError } from "../../../src/lib/api.ts";
import { formatCompactNumber, formatRelativeDate } from "../../../src/lib/format.ts";
import { createUserMetadata } from "../../../src/lib/metadata.ts";

export const dynamic = "force-dynamic";

interface UserPageProps {
  params: Promise<{
    username: string;
  }>;
}

export async function generateMetadata({ params }: UserPageProps) {
  const { username } = await params;

  try {
    const user = await getPublicUserByUsername(username);
    return createUserMetadata(user);
  } catch (error) {
    if (error instanceof WebApiError && error.statusCode === 404) {
      return {
        title: "Creator not found | Dupe Hunt"
      };
    }

    throw error;
  }
}

export default async function UserPage({ params }: UserPageProps) {
  const { username } = await params;

  try {
    const [user, feed] = await Promise.all([
      getPublicUserByUsername(username),
      listFeed({
        tab: "new",
        username,
        limit: 12
      })
    ]);

    return (
      <div className="page-stack">
        <section className="profile-hero">
          <div className="profile-hero__avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="profile-hero__body">
            <p className="eyebrow">Creator profile</p>
            <h1>@{user.username}</h1>
            <p className="hero-panel__lede">{user.bio?.trim() || "Sharing honest picks, verified receipts, and affordable alternatives."}</p>
            <div className="profile-hero__stats">
              <span>{formatCompactNumber(user.total_upvotes)} total upvotes</span>
              <span>{formatCompactNumber(user.verified_buy_count)} verified buys</span>
              <span>Active {formatRelativeDate(user.last_active_at)}</span>
            </div>
          </div>
        </section>

        <DownloadAppBanner />

        {feed.posts.length > 0 ? (
          <section className="post-grid">
            {feed.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </section>
        ) : (
          <EmptyState
            description="This creator profile exists, but no active dupes are currently browseable on the web."
            title="No public posts yet"
          />
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof WebApiError && error.statusCode === 404) {
      notFound();
    }

    return (
      <div className="page-stack">
        <section className="profile-hero">
          <div className="profile-hero__avatar">{username.slice(0, 1).toUpperCase()}</div>
          <div className="profile-hero__body">
            <p className="eyebrow">Creator profile</p>
            <h1>@{username}</h1>
            <p className="hero-panel__lede">This creator page is temporarily in fallback mode while live profile data reloads.</p>
          </div>
        </section>
        <DownloadAppBanner />
        <EmptyState
          description="The creator profile could not load right now. Retry soon or browse community search instead."
          title="Creator page unavailable"
        />
      </div>
    );
  }
}
