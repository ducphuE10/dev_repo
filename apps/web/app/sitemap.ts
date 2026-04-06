import type { MetadataRoute } from "next";

import { getCategories, listFeed } from "../src/lib/api.ts";
import { buildAppUrl } from "../src/lib/env.ts";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, latestFeed, trendingFeed] = await Promise.all([
    getCategories(),
    listFeed({
      tab: "new",
      limit: 25
    }),
    listFeed({
      tab: "trending",
      limit: 25
    })
  ]);

  const recentPosts = [...latestFeed.posts, ...trendingFeed.posts].reduce<
    Array<(typeof latestFeed.posts)[number]>
  >((posts, post) => {
    if (!posts.some((entry) => entry.id === post.id)) {
      posts.push(post);
    }

    return posts;
  }, []);

  const authorUsernames = Array.from(new Set(recentPosts.map((post) => post.user.username)));

  return [
    {
      url: buildAppUrl("/"),
      changeFrequency: "hourly",
      priority: 1
    },
    {
      url: buildAppUrl("/search"),
      changeFrequency: "hourly",
      priority: 0.8
    },
    ...categories.map((category) => ({
      url: buildAppUrl(`/${category.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.9
    })),
    ...recentPosts.map((post) => ({
      url: buildAppUrl(`/post/${post.id}`),
      lastModified: post.updated_at,
      changeFrequency: "daily" as const,
      priority: 0.8
    })),
    ...authorUsernames.map((username) => ({
      url: buildAppUrl(`/user/${username}`),
      changeFrequency: "weekly" as const,
      priority: 0.6
    }))
  ];
}
