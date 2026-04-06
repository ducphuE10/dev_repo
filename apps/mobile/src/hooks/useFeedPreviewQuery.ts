import type { FeedTab } from "@dupe-hunt/types";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export const useInfiniteFeedQuery = (input: { tab: FeedTab; categorySlug?: string | null }) => {
  const apiClient = useApiClient();

  return useInfiniteQuery({
    queryKey: ["feed", input.tab, input.categorySlug ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const response = await apiClient.listFeed({
        tab: input.tab,
        limit: 10,
        cursor: pageParam ?? undefined,
        categorySlug: input.categorySlug ?? undefined
      });

      return response;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor
  });
};

export const usePostDetailQuery = (postId: string | null) => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["post-detail", postId],
    enabled: Boolean(postId),
    queryFn: async () => {
      const response = await apiClient.getPost(postId as string);
      return response.post;
    }
  });
};
