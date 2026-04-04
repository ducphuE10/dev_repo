import Link from "next/link";

export const SiteHeader = () => (
  <header className="site-header">
    <div className="shell site-header__inner">
      <Link className="brand-mark" href="/">
        <span className="brand-mark__eyebrow">Real people. Real dupes.</span>
        <span className="brand-mark__wordmark">Dupe Hunt</span>
      </Link>

      <nav className="site-nav" aria-label="Primary">
        <Link href="/">Trending</Link>
        <Link href="/search">Search</Link>
        <a href="https://apps.apple.com" rel="noreferrer" target="_blank">
          Get the app
        </a>
      </nav>
    </div>
  </header>
);
