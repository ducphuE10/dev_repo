import Link from "next/link";
import { notFound } from "next/navigation";

import { DownloadAppBanner } from "../../../src/components/DownloadAppBanner.tsx";
import { getPost, WebApiError } from "../../../src/lib/api.ts";
import { formatCompactNumber, formatCurrency, formatPriceSaved, formatRelativeDate } from "../../../src/lib/format.ts";
import { createPostMetadata } from "../../../src/lib/metadata.ts";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: Promise<{
    id: string;
  }>;
}

const formatVerificationLabel = (status: "not_submitted" | "pending" | "verified" | "failed") => {
  switch (status) {
    case "verified":
      return "Verified buy";
    case "pending":
      return "Receipt pending";
    case "failed":
      return "Receipt check failed";
    default:
      return "Community reviewed";
  }
};

export async function generateMetadata({ params }: PostPageProps) {
  const { id } = await params;

  try {
    const post = await getPost(id);
    return createPostMetadata(post);
  } catch (error) {
    if (error instanceof WebApiError && error.statusCode === 404) {
      return {
        title: "Dupe not found | Dupe Hunt"
      };
    }

    throw error;
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  try {
    const post = await getPost(id);

    return (
      <div className="page-stack">
        <section className="detail-hero">
          <div className="detail-hero__copy">
            <p className="eyebrow">{post.category.name}</p>
            <h1>Best dupe for {post.original_product_name}</h1>
            <p className="hero-panel__lede">
              {post.dupe_product_name}
              {post.dupe_brand ? ` by ${post.dupe_brand}` : ""} gives the same energy for{" "}
              {formatCurrency(post.dupe_price, post.dupe_currency)}. {formatPriceSaved(post.price_saved, post.dupe_currency)}.
            </p>

            <div className="detail-hero__stats">
              <span>{formatCompactNumber(post.upvote_count)} upvotes</span>
              <span>{formatRelativeDate(post.created_at)}</span>
              <span>{formatVerificationLabel(post.receipt_verification_status)}</span>
            </div>

            <div className="detail-hero__actions">
              {post.affiliate_link ? (
                <Link className="cta-button" href={`/affiliate/go/${post.id}`}>
                  Buy this dupe
                </Link>
              ) : null}
              <Link className="ghost-button" href={`/user/${post.user.username}`}>
                More from @{post.user.username}
              </Link>
            </div>
          </div>

          <div className="detail-hero__media">
            {post.media_urls[0] ? (
              <img alt={post.dupe_product_name} className="detail-hero__image" src={post.media_urls[0]} />
            ) : (
              <div className="detail-hero__placeholder">No media uploaded</div>
            )}
          </div>
        </section>

        <section className="comparison-grid">
          <article className="comparison-card">
            <p className="eyebrow">Original</p>
            <h2>{post.original_product_name}</h2>
            <p>{post.original_brand ?? "Brand not provided"}</p>
            <strong>{formatCurrency(post.original_price, post.original_currency)}</strong>
          </article>
          <article className="comparison-card comparison-card--dupe">
            <p className="eyebrow">Dupe</p>
            <h2>{post.dupe_product_name}</h2>
            <p>{post.dupe_brand ?? "Brand not provided"}</p>
            <strong>{formatCurrency(post.dupe_price, post.dupe_currency)}</strong>
          </article>
        </section>

        <section className="detail-grid">
          <article className="detail-panel">
            <h2>Creator review</h2>
            <p>{post.review_text?.trim() || "This creator shared the swap without extra review text."}</p>
          </article>

          <article className="detail-panel">
            <h2>Why people save this</h2>
            <ul className="detail-list">
              <li>{formatPriceSaved(post.price_saved, post.dupe_currency)}</li>
              <li>{formatCompactNumber(post.upvote_count)} people upvoted this comparison</li>
              <li>
                {post.receipt_verification_status === "verified"
                  ? "Receipt-verified by the creator"
                  : post.receipt_verification_status === "pending"
                    ? "Receipt uploaded and still in OCR review"
                    : post.receipt_verification_status === "failed"
                      ? "Receipt OCR could not confirm this purchase"
                      : "Community reviewed and still browseable"}
              </li>
            </ul>
          </article>

          <article className="detail-panel">
            <h2>Creator</h2>
            <p className="detail-user">@{post.user.username}</p>
            <p>{post.user.verified_buy_count} verified buys</p>
            <p>{post.user.contributor_tier} contributor tier</p>
            <Link className="inline-link" href={`/user/${post.user.username}`}>
              View profile
            </Link>
          </article>
        </section>

        <DownloadAppBanner />
      </div>
    );
  } catch (error) {
    if (error instanceof WebApiError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }
}
