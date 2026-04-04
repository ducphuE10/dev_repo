import * as ImagePicker from "expo-image-picker";
import type { ApiPostMediaType } from "@dupe-hunt/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export type PostCaptureSource = "camera" | "gallery";

export interface PostComposerSelectedMedia {
  durationMs: number | null;
  fileName: string;
  fileSize: number | null;
  height: number;
  mimeType: string;
  uri: string;
  width: number;
}

export interface PostComposerDraft {
  mediaType: ApiPostMediaType;
  captureSource: PostCaptureSource;
  selectedMedia: PostComposerSelectedMedia | null;
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
  selectedMedia: null,
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

const inferPickerMimeType = (mediaType: ApiPostMediaType, asset: ImagePicker.ImagePickerAsset) =>
  asset.mimeType ?? (mediaType === "photo" ? "image/jpeg" : "video/mp4");

const inferPickerFileName = (mediaType: ApiPostMediaType, asset: ImagePicker.ImagePickerAsset) => {
  const trimmedFileName = asset.fileName?.trim();

  if (trimmedFileName) {
    return trimmedFileName;
  }

  const uriSegment = asset.uri.split("/").pop()?.split("?")[0]?.trim();

  if (uriSegment) {
    return uriSegment;
  }

  return mediaType === "photo" ? "dupe-photo.jpg" : "dupe-video.mp4";
};

const normalizeSelectedMedia = (
  mediaType: ApiPostMediaType,
  asset: ImagePicker.ImagePickerAsset
): PostComposerSelectedMedia => ({
  durationMs: asset.duration ?? null,
  fileName: inferPickerFileName(mediaType, asset),
  fileSize: asset.fileSize ?? null,
  height: asset.height,
  mimeType: inferPickerMimeType(mediaType, asset),
  uri: asset.uri,
  width: asset.width
});

const inferUploadExtension = (selectedMedia: PostComposerSelectedMedia | null, mediaType: ApiPostMediaType) => {
  const fileNameExtension = selectedMedia?.fileName.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();

  if (fileNameExtension) {
    return fileNameExtension;
  }

  if (selectedMedia?.mimeType === "image/png") {
    return "png";
  }

  if (selectedMedia?.mimeType === "image/heic" || selectedMedia?.mimeType === "image/heif") {
    return "heic";
  }

  return mediaType === "photo" ? "jpg" : "mp4";
};

const getPickerMediaTypes = (mediaType: ApiPostMediaType): ImagePicker.MediaType[] =>
  mediaType === "photo" ? ["images"] : ["videos"];

const getPickerOptions = (mediaType: ApiPostMediaType): ImagePicker.ImagePickerOptions => ({
  allowsEditing: false,
  mediaTypes: getPickerMediaTypes(mediaType),
  quality: mediaType === "photo" ? 0.92 : 1,
  videoMaxDuration: mediaType === "video" ? 60 : undefined
});

const ensurePickerPermission = async (captureSource: PostCaptureSource) => {
  const permission =
    captureSource === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      captureSource === "camera"
        ? "Camera access is required to capture media for a post."
        : "Photo library access is required to select media for a post."
    );
  }
};

export const pickComposerMedia = async (input: {
  captureSource: PostCaptureSource;
  mediaType: ApiPostMediaType;
}): Promise<PostComposerSelectedMedia | null> => {
  await ensurePickerPermission(input.captureSource);

  const pickerResult =
    input.captureSource === "camera"
      ? await ImagePicker.launchCameraAsync(getPickerOptions(input.mediaType))
      : await ImagePicker.launchImageLibraryAsync(getPickerOptions(input.mediaType));

  if (pickerResult.canceled) {
    return null;
  }

  const asset = pickerResult.assets[0];

  if (!asset) {
    throw new Error("No media asset was returned by the picker.");
  }

  return normalizeSelectedMedia(input.mediaType, asset);
};

const toUploadFileName = (draft: PostComposerDraft) => {
  const preferredName = draft.selectedMedia?.fileName?.replace(/\.[^.]+$/u, "");
  const baseName = `${draft.captureSource}-${preferredName || draft.dupeProductName || draft.originalProductName || "dupe"}`.replace(
    /[^a-z0-9]+/gi,
    "-"
  );
  const extension = inferUploadExtension(draft.selectedMedia, draft.mediaType);

  return `${baseName.replace(/^-+|-+$/g, "").toLowerCase() || "dupe-post"}.${extension}`;
};

const uploadSelectedMedia = async (uploadUrl: string, selectedMedia: PostComposerSelectedMedia) => {
  const localAssetResponse = await fetch(selectedMedia.uri);

  if (!localAssetResponse.ok) {
    throw new Error("Could not read the selected media file.");
  }

  const assetBlob = await localAssetResponse.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": selectedMedia.mimeType
    },
    body: assetBlob
  });

  if (!uploadResponse.ok) {
    throw new Error("Could not upload the selected media file.");
  }
};

export const usePublishPostMutation = () => {
  const apiClient = useApiClient({ requireAuth: true });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: PostComposerDraft) => {
      if (!draft.categoryId) {
        throw new Error("Pick a category before publishing.");
      }

      if (!draft.selectedMedia) {
        throw new Error("Choose a photo or video before publishing.");
      }

      const originalPrice = Number(draft.originalPrice);
      const dupePrice = Number(draft.dupePrice);

      if (!Number.isFinite(originalPrice) || !Number.isFinite(dupePrice)) {
        throw new Error("Original and dupe prices must be valid numbers.");
      }

      const mediaUpload = await apiClient.requestMediaUpload({
        media_type: draft.mediaType,
        content_type: draft.selectedMedia.mimeType,
        file_name: toUploadFileName(draft)
      });
      await uploadSelectedMedia(mediaUpload.upload_url, draft.selectedMedia);
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
