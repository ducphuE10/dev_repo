import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state empty-state--full">
      <p className="eyebrow">404</p>
      <h1>That dupe page is gone.</h1>
      <p>The link may be stale, the post may have been removed, or the creator has not published it publicly anymore.</p>
      <Link className="cta-button" href="/">
        Back to trending dupes
      </Link>
    </section>
  );
}
