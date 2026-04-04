import type { ApiPostMediaType } from "@dupe-hunt/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export type PostCaptureSource = "camera" | "gallery";

export interface PostComposerDraft {
  mediaType: ApiPostMediaType;
  captureSource: PostCaptureSource;
  categoryId: number | null;
  originalProductName: string;
  originalBrand: string;
  originalPrice: string;
  dupeProductName: string;
  dupeBrand: string;
  dupePrice: string;
  reviewText: string;
  affiliateLink: string;
}

export const createPostComposerDraft = (input: {
  captureSource: PostCaptureSource;
  mediaType: ApiPostMediaType;
}): PostComposerDraft => ({
  mediaType: input.mediaType,
  captureSource: input.captureSource,
  categoryId: null,
  originalProductName: "",
  originalBrand: "",
  originalPrice: "",
  dupeProductName: "",
  dupeBrand: "",
  dupePrice: "",
  reviewText: "",
  affiliateLink: ""
});

const toUploadFileName = (draft: PostComposerDraft) => {
  const baseName = `${draft.captureSource}-${draft.dupeProductName || draft.originalProductName || "dupe"}`.replace(
    /[^a-z0-9]+/gi,
    "-"
  );
  const extension = draft.mediaType === "photo" ? "jpg" : "mp4";

  return `${baseName.replace(/^-+|-+$/g, "").toLowerCase() || "dupe-post"}.${extension}`;
};

export const usePublishPostMutation = () => {
  const apiClient = useApiClient({ requireAuth: true });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: PostComposerDraft) => {
      if (!draft.categoryId) {
        throw new Error("Pick a category before publishing.");
      }

      const originalPrice = Number(draft.originalPrice);
      const dupePrice = Number(draft.dupePrice);

      if (!Number.isFinite(originalPrice) || !Number.isFinite(dupePrice)) {
        throw new Error("Original and dupe prices must be valid numbers.");
      }

      const mediaUpload = await apiClient.requestMediaUpload({
        media_type: draft.mediaType,
        content_type: draft.mediaType === "photo" ? "image/jpeg" : "video/mp4",
        file_name: toUploadFileName(draft)
      });
      const response = await apiClient.createPost({
        category_id: draft.categoryId,
        original_product_name: draft.originalProductName.trim(),
        original_brand: draft.originalBrand.trim() || undefined,
        original_price: originalPrice,
        original_currency: "USD",
        dupe_product_name: draft.dupeProductName.trim(),
        dupe_brand: draft.dupeBrand.trim() || undefined,
        dupe_price: dupePrice,
        dupe_currency: "USD",
        media_type: draft.mediaType,
        media_urls: [mediaUpload.media_url],
        review_text: draft.reviewText.trim() || undefined,
        affiliate_link: draft.affiliateLink.trim() || undefined
      });

      return {
        mediaUpload,
        post: response.post
      };
    },
    onSuccess: async ({ post }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["feed"]
        }),
        queryClient.invalidateQueries({
          queryKey: ["saved-posts"]
        }),
        queryClient.invalidateQueries({
          queryKey: ["current-user"]
        })
      ]);
      queryClient.setQueryData(["post-detail", post.id], post);
    }
  });
};
