import type { FeedTab } from "@dupe-hunt/types";

import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export const useFeedPreviewQuery = (tab: FeedTab) => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["feed-preview", tab],
    queryFn: async () => {
      const response = await apiClient.listFeed({ tab, limit: 6 });
      return response.posts;
    }
  });
};
