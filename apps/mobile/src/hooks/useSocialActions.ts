import type { ApiFeedResponse, ApiPost } from "@dupe-hunt/types";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

interface ViewerInteractionState {
  downvotedPostIds: string[];
  followedUserIds: string[];
  savedPostIds: string[];
  upvotedPostIds: string[];
}

type PostInteractionAction = "downvote" | "removeDownvote" | "removeSave" | "removeUpvote" | "save" | "upvote";
type FollowAction = "follow" | "unfollow";

interface CacheSnapshot {
  feedSnapshots: Array<[QueryKey, InfiniteData<ApiFeedResponse> | undefined]>;
  interactionState: ViewerInteractionState;
  postDetailSnapshot: ApiPost | undefined;
  savedPostsSnapshot: ApiPost[] | undefined;
}

const viewerInteractionKey = ["viewer-interactions"];

const emptyViewerInteractionState = (): ViewerInteractionState => ({
  downvotedPostIds: [],
  followedUserIds: [],
  savedPostIds: [],
  upvotedPostIds: []
});

const includeId = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

const omitId = (ids: string[], id: string) => ids.filter((entry) => entry !== id);

const clampCount = (value: number) => (value < 0 ? 0 : value);

const readViewerInteractionState = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.getQueryData<ViewerInteractionState>(viewerInteractionKey) ?? emptyViewerInteractionState();

const writeViewerInteractionState = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (state: ViewerInteractionState) => ViewerInteractionState
) => {
  const currentState = readViewerInteractionState(queryClient);
  const nextState = updater(currentState);

  queryClient.setQueryData(viewerInteractionKey, nextState);

  return nextState;
};

const updateInteractionState = (state: ViewerInteractionState, postId: string, action: PostInteractionAction) => {
  switch (action) {
    case "upvote":
      return {
        ...state,
        downvotedPostIds: omitId(state.downvotedPostIds, postId),
        upvotedPostIds: includeId(state.upvotedPostIds, postId)
      };
    case "removeUpvote":
      return {
        ...state,
        upvotedPostIds: omitId(state.upvotedPostIds, postId)
      };
    case "downvote":
      return {
        ...state,
        downvotedPostIds: includeId(state.downvotedPostIds, postId),
        upvotedPostIds: omitId(state.upvotedPostIds, postId)
      };
    case "removeDownvote":
      return {
        ...state,
        downvotedPostIds: omitId(state.downvotedPostIds, postId)
      };
    case "save":
      return {
        ...state,
        savedPostIds: includeId(state.savedPostIds, postId)
      };
    case "removeSave":
      return {
        ...state,
        savedPostIds: omitId(state.savedPostIds, postId)
      };
  }
};

const updateFollowState = (state: ViewerInteractionState, userId: string, action: FollowAction) => {
  if (action === "follow") {
    return {
      ...state,
      followedUserIds: includeId(state.followedUserIds, userId)
    };
  }

  return {
    ...state,
    followedUserIds: omitId(state.followedUserIds, userId)
  };
};

const applyPostActionToPost = (post: ApiPost, action: PostInteractionAction, state: ViewerInteractionState) => {
  const isDownvoted = state.downvotedPostIds.includes(post.id);
  const isUpvoted = state.upvotedPostIds.includes(post.id);

  switch (action) {
    case "upvote":
      return isUpvoted
        ? post
        : {
            ...post,
            downvote_count: isDownvoted ? clampCount(post.downvote_count - 1) : post.downvote_count,
            upvote_count: post.upvote_count + 1
          };
    case "removeUpvote":
      return isUpvoted
        ? {
            ...post,
            upvote_count: clampCount(post.upvote_count - 1)
          }
        : post;
    case "downvote":
      return isDownvoted
        ? post
        : {
            ...post,
            downvote_count: post.downvote_count + 1,
            upvote_count: isUpvoted ? clampCount(post.upvote_count - 1) : post.upvote_count
          };
    case "removeDownvote":
      return isDownvoted
        ? {
            ...post,
            downvote_count: clampCount(post.downvote_count - 1)
          }
        : post;
    case "save":
    case "removeSave":
      return post;
  }
};

const replacePostInCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  updater: (post: ApiPost) => ApiPost
) => {
  for (const [queryKey, data] of queryClient.getQueriesData<InfiniteData<ApiFeedResponse>>({
    queryKey: ["feed"]
  })) {
    if (!data) {
      continue;
    }

    queryClient.setQueryData<InfiniteData<ApiFeedResponse>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: page.posts.map((post) => (post.id === postId ? updater(post) : post))
      }))
    });
  }

  queryClient.setQueryData<ApiPost | undefined>(["post-detail", postId], (currentPost) =>
    currentPost ? updater(currentPost) : currentPost
  );
  queryClient.setQueryData<ApiPost[] | undefined>(["saved-posts"], (currentPosts) =>
    currentPosts ? currentPosts.map((post) => (post.id === postId ? updater(post) : post)) : currentPosts
  );
};

const replacePostEverywhere = (queryClient: ReturnType<typeof useQueryClient>, nextPost: ApiPost) => {
  replacePostInCaches(queryClient, nextPost.id, () => nextPost);
};

const readPostFromCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  fallbackPost?: ApiPost
) => {
  const detailPost = queryClient.getQueryData<ApiPost>(["post-detail", postId]);

  if (detailPost) {
    return detailPost;
  }

  const savedPosts = queryClient.getQueryData<ApiPost[]>(["saved-posts"]);
  const savedPost = savedPosts?.find((post) => post.id === postId);

  if (savedPost) {
    return savedPost;
  }

  for (const [, data] of queryClient.getQueriesData<InfiniteData<ApiFeedResponse>>({ queryKey: ["feed"] })) {
    const matchingPost = data?.pages.flatMap((page) => page.posts).find((post) => post.id === postId);

    if (matchingPost) {
      return matchingPost;
    }
  }

  return fallbackPost ?? null;
};

const syncSavedPostList = (
  queryClient: ReturnType<typeof useQueryClient>,
  input: { post: ApiPost; saveState: "saved" | "removed" }
) => {
  queryClient.setQueryData<ApiPost[] | undefined>(["saved-posts"], (currentPosts) => {
    if (!currentPosts) {
      return currentPosts;
    }

    if (input.saveState === "saved") {
      const existingPosts = currentPosts.filter((post) => post.id !== input.post.id);
      return [input.post, ...existingPosts];
    }

    return currentPosts.filter((post) => post.id !== input.post.id);
  });
};

const restoreCacheSnapshot = (queryClient: ReturnType<typeof useQueryClient>, snapshot: CacheSnapshot, postId: string) => {
  queryClient.setQueryData(viewerInteractionKey, snapshot.interactionState);

  for (const [queryKey, data] of snapshot.feedSnapshots) {
    queryClient.setQueryData(queryKey, data);
  }

  queryClient.setQueryData(["post-detail", postId], snapshot.postDetailSnapshot);
  queryClient.setQueryData(["saved-posts"], snapshot.savedPostsSnapshot);
};

export const usePostSocialActions = (input: { authorUserId?: string | null; post: ApiPost }) => {
  const apiClient = useApiClient({ requireAuth: true });
  const queryClient = useQueryClient();

  const interactionQuery = useQuery({
    queryKey: viewerInteractionKey,
    queryFn: async () => emptyViewerInteractionState(),
    initialData: emptyViewerInteractionState,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY
  });

  const postActionMutation = useMutation({
    mutationFn: async (action: PostInteractionAction) => {
      switch (action) {
        case "upvote":
          return apiClient.upvotePost(input.post.id);
        case "removeUpvote":
          return apiClient.removeUpvote(input.post.id);
        case "downvote":
          return apiClient.downvotePost(input.post.id);
        case "removeDownvote":
          return apiClient.removeDownvote(input.post.id);
        case "save":
          return apiClient.savePost(input.post.id);
        case "removeSave":
          return apiClient.removeSavedPost(input.post.id);
      }
    },
    onMutate: async (action) => {
      const cacheSnapshot: CacheSnapshot = {
        feedSnapshots: queryClient.getQueriesData<InfiniteData<ApiFeedResponse>>({
          queryKey: ["feed"]
        }),
        interactionState: readViewerInteractionState(queryClient),
        postDetailSnapshot: queryClient.getQueryData<ApiPost>(["post-detail", input.post.id]),
        savedPostsSnapshot: queryClient.getQueryData<ApiPost[]>(["saved-posts"])
      };
      const cachedPost = readPostFromCaches(queryClient, input.post.id, input.post);

      writeViewerInteractionState(queryClient, (state) => updateInteractionState(state, input.post.id, action));

      if (cachedPost) {
        replacePostInCaches(queryClient, input.post.id, (post) => applyPostActionToPost(post, action, cacheSnapshot.interactionState));

        if (action === "save") {
          syncSavedPostList(queryClient, {
            post: cachedPost,
            saveState: "saved"
          });
        }

        if (action === "removeSave") {
          syncSavedPostList(queryClient, {
            post: cachedPost,
            saveState: "removed"
          });
        }
      }

      return cacheSnapshot;
    },
    onError: (_error, _action, snapshot) => {
      if (!snapshot) {
        return;
      }

      restoreCacheSnapshot(queryClient, snapshot, input.post.id);
    },
    onSuccess: (response, action) => {
      if (response && typeof response === "object" && "post" in response) {
        replacePostEverywhere(queryClient, response.post);

        if (action === "save") {
          syncSavedPostList(queryClient, {
            post: response.post,
            saveState: "saved"
          });
        }
      }
    }
  });

  const interactionState = interactionQuery.data;
  const savedPosts = queryClient.getQueryData<ApiPost[]>(["saved-posts"]) ?? [];
  const isDownvoted = interactionState.downvotedPostIds.includes(input.post.id);
  const isSaved = interactionState.savedPostIds.includes(input.post.id) || savedPosts.some((post) => post.id === input.post.id);
  const isUpvoted = interactionState.upvotedPostIds.includes(input.post.id);

  return {
    isDownvoted,
    isSaved,
    isUpvoted,
    isWorking: postActionMutation.isPending,
    toggleDownvote: () => postActionMutation.mutate(isDownvoted ? "removeDownvote" : "downvote"),
    toggleSave: () => postActionMutation.mutate(isSaved ? "removeSave" : "save"),
    toggleUpvote: () => postActionMutation.mutate(isUpvoted ? "removeUpvote" : "upvote")
  };
};

export const useFollowUserAction = (userId: string | null) => {
  const apiClient = useApiClient({ requireAuth: true });
  const queryClient = useQueryClient();

  const interactionQuery = useQuery({
    queryKey: viewerInteractionKey,
    queryFn: async () => emptyViewerInteractionState(),
    initialData: emptyViewerInteractionState,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY
  });

  const followMutation = useMutation({
    mutationFn: async (action: FollowAction) => {
      if (!userId) {
        throw new Error("No user selected.");
      }

      if (action === "follow") {
        await apiClient.followUser(userId);
        return;
      }

      await apiClient.unfollowUser(userId);
    },
    onMutate: async (action) => {
      const previousState = readViewerInteractionState(queryClient);

      writeViewerInteractionState(queryClient, (state) => updateFollowState(state, userId as string, action));

      return previousState;
    },
    onError: (_error, _action, previousState) => {
      if (!previousState) {
        return;
      }

      queryClient.setQueryData(viewerInteractionKey, previousState);
    }
  });

  const isFollowing = userId ? interactionQuery.data.followedUserIds.includes(userId) : false;

  return {
    isFollowing,
    isWorking: followMutation.isPending,
    toggleFollow: () => {
      if (!userId) {
        return;
      }

      followMutation.mutate(isFollowing ? "unfollow" : "follow");
    }
  };
};
