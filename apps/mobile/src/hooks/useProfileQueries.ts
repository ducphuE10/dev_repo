import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export const useCurrentUserQuery = () => {
  const apiClient = useApiClient({ requireAuth: true });

  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await apiClient.getCurrentUser();
      return response.user;
    }
  });
};

export const useSavedPostsQuery = () => {
  const apiClient = useApiClient({ requireAuth: true });

  return useQuery({
    queryKey: ["saved-posts"],
    queryFn: async () => {
      const response = await apiClient.listSavedPosts();
      return response.posts;
    }
  });
};

export const usePublicUserQuery = (userId: string | null) => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["public-user", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await apiClient.getPublicUser(userId as string);
      return response.user;
    }
  });
};

export const useUpdateCurrentUserMutation = () => {
  const apiClient = useApiClient({ requireAuth: true });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { username?: string; bio?: string | null; avatar_url?: string | null }) => {
      const response = await apiClient.updateCurrentUser(input);
      return response.user;
    },
    onSuccess: async (user) => {
      queryClient.setQueryData(["current-user"], user);
      await queryClient.invalidateQueries({
        queryKey: ["feed"]
      });
    }
  });
};
