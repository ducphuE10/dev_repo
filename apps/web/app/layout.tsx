import type { Metadata } from "next";

import { SiteHeader } from "../src/components/SiteHeader.tsx";
import { buildAppUrl } from "../src/lib/env.ts";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(buildAppUrl("/")),
  title: {
    default: "Dupe Hunt",
    template: "%s | Dupe Hunt"
  },
  description: "Community-powered dupes from real people with honest reviews and transparent savings.",
  alternates: {
    canonical: buildAppUrl("/")
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="background-glow background-glow--one" />
        <div className="background-glow background-glow--two" />
        <div className="site-frame">
          <SiteHeader />
          <main className="shell site-main">{children}</main>
          <footer className="shell site-footer">
            <p>Dupe Hunt is browse-only on web. Download the app to post reviews and receipts.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
