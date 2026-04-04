import Link from "next/link";

import type { ApiPost } from "@dupe-hunt/types";

import { formatCompactNumber, formatCurrency, formatPriceSaved, formatRelativeDate } from "../lib/format.ts";

interface PostCardProps {
  post: ApiPost;
}

const renderMedia = (post: ApiPost) => {
  const mediaUrl = post.media_urls[0];

  if (!mediaUrl) {
    return <div className="post-card__placeholder">{post.category.name}</div>;
  }

  return <img alt={post.dupe_product_name} className="post-card__image" loading="lazy" src={mediaUrl} />;
};

export const PostCard = ({ post }: PostCardProps) => (
  <article className="post-card">
    <Link aria-label={`Open ${post.dupe_product_name}`} className="post-card__media" href={`/post/${post.id}`}>
      {renderMedia(post)}
      <span className="post-card__badge">{post.media_type === "video" ? "Video review" : "Photo review"}</span>
    </Link>

    <div className="post-card__body">
      <div className="post-card__meta-row">
        <Link className="post-card__category" href={`/${post.category.slug}`}>
          {post.category.name}
        </Link>
        <span>{formatRelativeDate(post.created_at)}</span>
      </div>

      <Link className="post-card__title" href={`/post/${post.id}`}>
        Best dupe for {post.original_product_name}
      </Link>

      <p className="post-card__subtitle">
        {post.dupe_product_name}
        {post.dupe_brand ? ` by ${post.dupe_brand}` : ""} · {formatCurrency(post.dupe_price, post.dupe_currency)}
      </p>

      <p className="post-card__summary">
        {post.review_text?.trim() || `${formatPriceSaved(post.price_saved, post.dupe_currency)} with a community-backed swap.`}
      </p>

      <div className="post-card__footer">
        <Link className="post-card__author" href={`/user/${post.user.username}`}>
          <span className="post-card__avatar">{post.user.username.slice(0, 1).toUpperCase()}</span>
          <span>
            @{post.user.username}
            <strong>{post.is_verified_buy ? "Verified buy" : "Community pick"}</strong>
          </span>
        </Link>

        <div className="post-card__stats">
          <span>{formatCompactNumber(post.upvote_count)} upvotes</span>
          <span>{formatCompactNumber(post.flag_count)} flags</span>
        </div>
      </div>
    </div>
  </article>
);
