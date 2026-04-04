import { useEffect, useState } from "react";

import type { ApiCategory, ApiPost, FeedTab } from "@dupe-hunt/types";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { PrimaryButton } from "../components/PrimaryButton.tsx";
import { ScreenFrame } from "../components/ScreenFrame.tsx";
import { useCategoryOptionsQuery } from "../hooks/useCategoryOptionsQuery.ts";
import { createPostComposerDraft, usePublishPostMutation, type PostCaptureSource, type PostComposerDraft } from "../hooks/usePostComposer.ts";
import { useInfiniteFeedQuery, usePostDetailQuery } from "../hooks/useFeedPreviewQuery.ts";
import {
  useCurrentUserQuery,
  usePublicUserQuery,
  useSavedPostsQuery,
  useUpdateCurrentUserMutation
} from "../hooks/useProfileQueries.ts";
import { useFollowUserAction, usePostSocialActions } from "../hooks/useSocialActions.ts";
import { mobileAppShell } from "../lib/api.ts";

const feedTabs: FeedTab[] = ["for_you", "trending", "new"];
const composeCaptureSources: Array<{ description: string; label: string; value: PostCaptureSource }> = [
  {
    description: "Stage a fresh upload slot for a new clip or snap.",
    label: "Camera",
    value: "camera"
  },
  {
    description: "Use something you already picked out from your gallery roll.",
    label: "Gallery",
    value: "gallery"
  }
];
const composeMediaTypes: Array<{ description: string; label: string; value: "photo" | "video" }> = [
  {
    description: "Best for close-up comparisons, texture shots, and shelfies.",
    label: "Photo",
    value: "photo"
  },
  {
    description: "Best for wear tests, mini-hauls, and side-by-side demos.",
    label: "Video",
    value: "video"
  }
];

interface FeedScreenProps {
  navigation: {
    navigate: (routeName: "DupeDetail" | "PublicProfile", params: { postId?: string; userId?: string }) => void;
  };
}

interface DupeDetailScreenProps {
  navigation: {
    navigate: (routeName: "PublicProfile", params: { userId: string }) => void;
  };
  route: {
    params: {
      postId: string;
    };
  };
}

interface PostFormatScreenProps {
  navigation: {
    navigate: (routeName: "PostForm", params: { draft: PostComposerDraft }) => void;
  };
}

interface PostFormScreenProps {
  navigation: {
    navigate: (routeName: "PostPreview", params: { draft: PostComposerDraft }) => void;
  };
  route: {
    params: {
      draft: PostComposerDraft;
    };
  };
}

interface PostPreviewScreenProps {
  navigation: {
    popToTop?: () => void;
  };
  route: {
    params: {
      draft: PostComposerDraft;
    };
  };
}

interface ProfileScreenProps {
  navigation: {
    navigate: (
      routeName: "DupeDetail" | "EditProfile" | "PublicProfile" | "SavedCollection",
      params?: { postId?: string; userId?: string }
    ) => void;
  };
}

interface SavedCollectionScreenProps {
  navigation: {
    navigate: (routeName: "DupeDetail" | "PublicProfile", params: { postId?: string; userId?: string }) => void;
  };
}

interface EditProfileScreenProps {
  navigation: {
    goBack: () => void;
  };
}

interface PublicProfileScreenProps {
  route: {
    params: {
      userId: string;
    };
  };
}

const formatFeedTab = (tab: FeedTab) => tab.replace("_", " ").replace(/^\w/, (character) => character.toUpperCase());

const formatMoney = (value: number | null, currency: string) => {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency"
  }).format(value);
};

const formatTier = (tier: string) =>
  tier
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildAffiliateUrl = (postId: string) => `${mobileAppShell.apiBaseUrl.replace(/\/+$/g, "")}/affiliate/go/${postId}`;

const buildProfileMeta = (post: ApiPost) =>
  `${post.user.verified_buy_count} verified buys • ${post.upvote_count} upvotes on this review`;

const CategoryChips = ({
  categories,
  onSelect,
  selectedCategorySlug
}: {
  categories: ApiCategory[];
  onSelect: (slug: string | null) => void;
  selectedCategorySlug: string | null;
}) => (
  <View style={styles.chipRow}>
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(null)}
      style={[styles.categoryFilterChip, selectedCategorySlug === null ? styles.categoryFilterChipActive : undefined]}
    >
      <Text style={[styles.categoryFilterLabel, selectedCategorySlug === null ? styles.categoryFilterLabelActive : undefined]}>All</Text>
    </Pressable>
    {categories.map((category) => (
      <Pressable
        key={category.id}
        accessibilityRole="button"
        onPress={() => onSelect(category.slug)}
        style={[styles.categoryFilterChip, selectedCategorySlug === category.slug ? styles.categoryFilterChipActive : undefined]}
      >
        <Text style={[styles.categoryFilterLabel, selectedCategorySlug === category.slug ? styles.categoryFilterLabelActive : undefined]}>
          {category.icon ?? "✨"} {category.name}
        </Text>
      </Pressable>
    ))}
  </View>
);

const SocialActionChip = ({
  active = false,
  disabled = false,
  label,
  onPress
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={() => void onPress()}
    style={({ pressed }) => [
      styles.socialChip,
      active ? styles.socialChipActive : undefined,
      disabled ? styles.socialChipDisabled : undefined,
      pressed && !disabled ? styles.socialChipPressed : undefined
    ]}
  >
    <Text style={[styles.socialChipLabel, active ? styles.socialChipLabelActive : undefined]}>{label}</Text>
  </Pressable>
);

const ProfileStat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const PostActionBar = ({
  onOpenAuthor,
  post
}: {
  onOpenAuthor: () => void;
  post: ApiPost;
}) => {
  const social = usePostSocialActions({
    authorUserId: post.user.id,
    post
  });

  return (
    <View style={styles.postActionWrap}>
      <View style={styles.actionRow}>
        <SocialActionChip
          active={social.isUpvoted}
          disabled={social.isWorking}
          label={`Upvote ${post.upvote_count}`}
          onPress={social.toggleUpvote}
        />
        <SocialActionChip
          active={social.isDownvoted}
          disabled={social.isWorking}
          label={`Downvote ${post.downvote_count}`}
          onPress={social.toggleDownvote}
        />
        <SocialActionChip
          active={social.isSaved}
          disabled={social.isWorking}
          label={social.isSaved ? "Saved" : "Save"}
          onPress={social.toggleSave}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenAuthor} style={styles.authorLink}>
        <Text style={styles.authorLinkLabel}>@{post.user.username}</Text>
        <Text style={styles.authorLinkMeta}>{buildProfileMeta(post)}</Text>
      </Pressable>
    </View>
  );
};

const FeedPostCard = ({
  onOpenAuthor,
  onOpenPost,
  post
}: {
  onOpenAuthor: () => void;
  onOpenPost: () => void;
  post: ApiPost;
}) => (
  <Pressable accessibilityRole="button" onPress={onOpenPost} style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : undefined]}>
    <Text style={styles.cardEyebrow}>
      {post.category.icon ?? "✨"} {post.category.name}
    </Text>
    <Text style={styles.cardTitle}>
      {post.original_product_name} → {post.dupe_product_name}
    </Text>
    <Text style={styles.cardBody}>{post.review_text ?? "No written review yet."}</Text>
    <Text style={styles.cardMeta}>
      Save {formatMoney(post.price_saved, post.dupe_currency)} • {post.is_verified_buy ? "Verified buy" : "Community review"}
    </Text>
    <PostActionBar onOpenAuthor={onOpenAuthor} post={post} />
  </Pressable>
);

const ComposerInput = ({
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8C7768"
      style={[styles.input, multiline ? styles.textArea : undefined]}
      value={value}
    />
  </View>
);

const validateComposerDraft = (draft: PostComposerDraft) => {
  if (!draft.categoryId) {
    return "Choose a category before continuing.";
  }

  if (!draft.originalProductName.trim() || !draft.dupeProductName.trim()) {
    return "Add both the original product and the dupe.";
  }

  const originalPrice = Number(draft.originalPrice);
  const dupePrice = Number(draft.dupePrice);

  if (!Number.isFinite(originalPrice) || !Number.isFinite(dupePrice) || originalPrice <= 0 || dupePrice <= 0) {
    return "Enter valid positive prices for both products.";
  }

  if (draft.affiliateLink.trim().length > 0) {
    try {
      new URL(draft.affiliateLink.trim());
    } catch {
      return "Affiliate links need to be full URLs.";
    }
  }

  return null;
};

export const FeedScreen = ({ navigation }: FeedScreenProps) => {
  const [activeTab, setActiveTab] = useState<FeedTab>("for_you");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const { data: categories, error: categoryError } = useCategoryOptionsQuery();
  const { session } = useAuthSession();
  const availableCategoryFilters =
    categories && activeTab === "for_you" && session?.selectedCategoryIds.length
      ? categories.filter((category) => session.selectedCategoryIds.includes(category.id))
      : categories ?? [];

  useEffect(() => {
    if (selectedCategorySlug && !availableCategoryFilters.some((category) => category.slug === selectedCategorySlug)) {
      setSelectedCategorySlug(null);
    }
  }, [availableCategoryFilters, selectedCategorySlug]);

  const feedQuery = useInfiniteFeedQuery({
    tab: activeTab,
    categorySlug: selectedCategorySlug
  });
  const posts = feedQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const selectedCategoriesLabel =
    categories && session?.selectedCategoryIds.length
      ? categories
          .filter((category) => session.selectedCategoryIds.includes(category.id))
          .map((category) => category.name)
          .join(" • ")
      : "No saved categories yet.";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.feedContent}
        data={posts}
        keyExtractor={(post) => post.id}
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl onRefresh={() => void feedQuery.refetch()} refreshing={feedQuery.isRefetching} tintColor="#FF5A36" />}
        ListHeaderComponent={
          <View style={styles.feedHeader}>
            <Text style={styles.eyebrow}>Home</Text>
            <Text style={styles.feedTitle}>Browse real dupes</Text>
            <Text style={styles.feedDescription}>
              Feed pagination is live, and this pass adds fast upvote/save interactions plus direct creator profile routing from every post.
            </Text>

            <View style={styles.inlineRow}>
              {feedTabs.map((tab) => (
                <Pressable
                  key={tab}
                  accessibilityRole="button"
                  onPress={() => setActiveTab(tab)}
                  style={[styles.feedTab, tab === activeTab ? styles.feedTabActive : undefined]}
                >
                  <Text style={[styles.feedTabLabel, tab === activeTab ? styles.feedTabLabelActive : undefined]}>
                    {formatFeedTab(tab)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Saved categories</Text>
              <Text style={styles.cardBody}>{selectedCategoriesLabel}</Text>
            </View>

            {availableCategoryFilters.length > 0 ? (
              <CategoryChips
                categories={availableCategoryFilters}
                onSelect={setSelectedCategorySlug}
                selectedCategorySlug={selectedCategorySlug}
              />
            ) : null}

            {categoryError ? <Text style={styles.errorText}>{categoryError.message}</Text> : null}
            {feedQuery.error ? <Text style={styles.errorText}>{feedQuery.error.message}</Text> : null}
            {feedQuery.isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
          </View>
        }
        ListEmptyComponent={
          !feedQuery.isLoading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nothing in this lane yet</Text>
              <Text style={styles.cardBody}>Try another tab or clear the category filter to widen the feed.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.feedFooter}>
            {feedQuery.isFetchingNextPage ? <ActivityIndicator color="#FF5A36" /> : null}
            {!feedQuery.hasNextPage && posts.length > 0 ? (
              <Text style={styles.footerText}>You reached the end of this feed slice.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <FeedPostCard
            onOpenAuthor={() => navigation.navigate("PublicProfile", { userId: item.user.id })}
            onOpenPost={() => navigation.navigate("DupeDetail", { postId: item.id })}
            post={item}
          />
        )}
      />
    </SafeAreaView>
  );
};

export const DupeDetailScreen = ({ navigation, route }: DupeDetailScreenProps) => {
  const { data: post, error, isLoading, isRefetching, refetch } = usePostDetailQuery(route.params.postId);

  const handleAffiliatePress = async () => {
    if (!post?.affiliate_link) {
      return;
    }

    await Linking.openURL(buildAffiliateUrl(post.id));
  };

  return (
    <ScreenFrame
      eyebrow="Dupe detail"
      title={post ? `${post.dupe_product_name}` : "Loading post"}
      description={post ? `Compared against ${post.original_product_name} in ${post.category.name}.` : "Fetching the latest post payload from the API."}
      footer={post?.affiliate_link ? <PrimaryButton label="Buy this dupe" onPress={handleAffiliatePress} /> : undefined}
    >
      {isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
      {error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Could not load this post</Text>
          <Text style={styles.cardBody}>{error.message}</Text>
          <PrimaryButton disabled={isRefetching} label="Retry" onPress={() => void refetch()} />
        </View>
      ) : null}
      {post ? (
        <>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonLabel}>Original</Text>
              <Text style={styles.comparisonTitle}>{post.original_product_name}</Text>
              <Text style={styles.cardBody}>{post.original_brand ?? "Unknown brand"}</Text>
              <Text style={styles.priceText}>{formatMoney(post.original_price, post.original_currency)}</Text>
            </View>
            <View style={styles.comparisonColumn}>
              <Text style={styles.comparisonLabel}>Dupe</Text>
              <Text style={styles.comparisonTitle}>{post.dupe_product_name}</Text>
              <Text style={styles.cardBody}>{post.dupe_brand ?? "Unknown brand"}</Text>
              <Text style={styles.priceText}>{formatMoney(post.dupe_price, post.dupe_currency)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Why it hits</Text>
            <Text style={styles.cardBody}>{post.review_text ?? "No written review yet."}</Text>
            <Text style={styles.cardMeta}>
              Save {formatMoney(post.price_saved, post.dupe_currency)} • {post.is_verified_buy ? "Verified buy" : "Community review"}
            </Text>
            <PostActionBar onOpenAuthor={() => navigation.navigate("PublicProfile", { userId: post.user.id })} post={post} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Creator snapshot</Text>
            <Text style={styles.cardBody}>@{post.user.username}</Text>
            <Text style={styles.cardBody}>Tier: {formatTier(post.user.contributor_tier)}</Text>
            <Text style={styles.cardBody}>Verified buys: {post.user.verified_buy_count}</Text>
            <PrimaryButton label="Open profile" onPress={() => navigation.navigate("PublicProfile", { userId: post.user.id })} variant="secondary" />
          </View>
        </>
      ) : null}
    </ScreenFrame>
  );
};

export const SearchScreen = () => {
  const { data: categories } = useCategoryOptionsQuery();

  return (
    <ScreenFrame
      eyebrow="Search"
      title="Browse lanes are warmed up"
      description="Search still stays intentionally light on mobile, but category context is now shared with the live feed and profile flows."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category map</Text>
        <Text style={styles.cardBody}>
          {categories?.map((category) => `${category.icon ?? "✨"} ${category.slug}`).join(" • ") ?? "Loading category filters..."}
        </Text>
      </View>
    </ScreenFrame>
  );
};

export const PostFormatScreen = ({ navigation }: PostFormatScreenProps) => {
  const [selectedCaptureSource, setSelectedCaptureSource] = useState<PostCaptureSource>("camera");
  const [selectedMediaType, setSelectedMediaType] = useState<"photo" | "video">("photo");

  return (
    <ScreenFrame
      eyebrow="Create"
      title="Pick your post format"
      description="This flow reserves a real media-upload target, then walks through the full publish form and preview before posting to the API."
      footer={
        <PrimaryButton
          label="Continue to post form"
          onPress={() =>
            navigation.navigate("PostForm", {
              draft: createPostComposerDraft({
                captureSource: selectedCaptureSource,
                mediaType: selectedMediaType
              })
            })
          }
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Choose a capture lane</Text>
        <View style={styles.optionList}>
          {composeCaptureSources.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setSelectedCaptureSource(option.value)}
              style={[styles.optionCard, selectedCaptureSource === option.value ? styles.optionCardActive : undefined]}
            >
              <Text style={[styles.optionTitle, selectedCaptureSource === option.value ? styles.optionTitleActive : undefined]}>{option.label}</Text>
              <Text style={[styles.optionBody, selectedCaptureSource === option.value ? styles.optionBodyActive : undefined]}>
                {option.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Choose a media type</Text>
        <View style={styles.optionList}>
          {composeMediaTypes.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setSelectedMediaType(option.value)}
              style={[styles.optionCard, selectedMediaType === option.value ? styles.optionCardActive : undefined]}
            >
              <Text style={[styles.optionTitle, selectedMediaType === option.value ? styles.optionTitleActive : undefined]}>{option.label}</Text>
              <Text style={[styles.optionBody, selectedMediaType === option.value ? styles.optionBodyActive : undefined]}>
                {option.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
};

export const PostFormScreen = ({ navigation, route }: PostFormScreenProps) => {
  const { data: categories, error, isLoading } = useCategoryOptionsQuery();
  const [draft, setDraft] = useState(route.params.draft);
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <ScreenFrame
      eyebrow="Post form"
      title="Write the dupe breakdown"
      description={`Using the ${draft.captureSource} lane with a ${draft.mediaType} upload target.`}
      footer={
        <PrimaryButton
          label="Preview post"
          onPress={() => {
            const errorMessage = validateComposerDraft(draft);

            if (errorMessage) {
              setValidationError(errorMessage);
              return;
            }

            setValidationError(null);
            navigation.navigate("PostPreview", {
              draft
            });
          }}
        />
      }
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category</Text>
        {isLoading ? <ActivityIndicator color="#FF5A36" /> : null}
        {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
        {categories ? (
          <View style={styles.chipRow}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                onPress={() => setDraft((currentDraft) => ({ ...currentDraft, categoryId: category.id }))}
                style={[styles.categoryFilterChip, draft.categoryId === category.id ? styles.categoryFilterChipActive : undefined]}
              >
                <Text style={[styles.categoryFilterLabel, draft.categoryId === category.id ? styles.categoryFilterLabelActive : undefined]}>
                  {category.icon ?? "✨"} {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Original product</Text>
        <ComposerInput
          label="Name"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, originalProductName: value }))}
          placeholder="Dyson Airwrap"
          value={draft.originalProductName}
        />
        <ComposerInput
          label="Brand"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, originalBrand: value }))}
          placeholder="Dyson"
          value={draft.originalBrand}
        />
        <ComposerInput
          label="Price (USD)"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, originalPrice: value }))}
          placeholder="599"
          value={draft.originalPrice}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dupe product</Text>
        <ComposerInput
          label="Name"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, dupeProductName: value }))}
          placeholder="Shark FlexStyle"
          value={draft.dupeProductName}
        />
        <ComposerInput
          label="Brand"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, dupeBrand: value }))}
          placeholder="Shark"
          value={draft.dupeBrand}
        />
        <ComposerInput
          label="Price (USD)"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, dupePrice: value }))}
          placeholder="299"
          value={draft.dupePrice}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why it works</Text>
        <ComposerInput
          label="Review"
          multiline
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, reviewText: value }))}
          placeholder="Describe texture, quality, fit, wear test, or why this dupe actually holds up."
          value={draft.reviewText}
        />
        <ComposerInput
          label="Affiliate link (optional)"
          onChangeText={(value) => setDraft((currentDraft) => ({ ...currentDraft, affiliateLink: value }))}
          placeholder="https://shop.example.com/item"
          value={draft.affiliateLink}
        />
      </View>
      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
    </ScreenFrame>
  );
};

export const PostPreviewScreen = ({ navigation, route }: PostPreviewScreenProps) => {
  const publishMutation = usePublishPostMutation();
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null);
  const [reservedMediaUrl, setReservedMediaUrl] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const draft = route.params.draft;

  const handlePublish = async () => {
    setSubmissionError(null);

    try {
      const response = await publishMutation.mutateAsync(draft);

      setPublishedPostId(response.post.id);
      setReservedMediaUrl(response.mediaUpload.media_url);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not publish this post.");
    }
  };

  if (publishedPostId) {
    return (
      <ScreenFrame
        eyebrow="Published"
        title="Your dupe is live"
        description="The post was created through the real API and the feed cache was refreshed so it can appear in the home timeline."
        footer={<PrimaryButton label="Create another" onPress={() => navigation.popToTop?.()} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Post ID</Text>
          <Text style={styles.cardBody}>{publishedPostId}</Text>
        </View>
        {reservedMediaUrl ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reserved media URL</Text>
            <Text style={styles.monoText}>{reservedMediaUrl}</Text>
          </View>
        ) : null}
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      eyebrow="Preview"
      title={draft.dupeProductName || "Review your dupe post"}
      description="One last check before the publish call signs a media upload target and creates the post."
      footer={<PrimaryButton disabled={publishMutation.isPending} label="Publish post" onPress={handlePublish} />}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Media plan</Text>
        <Text style={styles.cardBody}>
          {draft.captureSource} lane • {draft.mediaType} upload
        </Text>
      </View>

      <View style={styles.comparisonCard}>
        <View style={styles.comparisonColumn}>
          <Text style={styles.comparisonLabel}>Original</Text>
          <Text style={styles.comparisonTitle}>{draft.originalProductName}</Text>
          <Text style={styles.cardBody}>{draft.originalBrand || "Unknown brand"}</Text>
          <Text style={styles.priceText}>{formatMoney(Number(draft.originalPrice), "USD")}</Text>
        </View>
        <View style={styles.comparisonColumn}>
          <Text style={styles.comparisonLabel}>Dupe</Text>
          <Text style={styles.comparisonTitle}>{draft.dupeProductName}</Text>
          <Text style={styles.cardBody}>{draft.dupeBrand || "Unknown brand"}</Text>
          <Text style={styles.priceText}>{formatMoney(Number(draft.dupePrice), "USD")}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Review copy</Text>
        <Text style={styles.cardBody}>{draft.reviewText || "No written review yet."}</Text>
        {draft.affiliateLink ? <Text style={styles.monoText}>{draft.affiliateLink}</Text> : null}
      </View>

      {submissionError ? <Text style={styles.errorText}>{submissionError}</Text> : null}
      {publishMutation.isPending ? <ActivityIndicator color="#FF5A36" /> : null}
    </ScreenFrame>
  );
};

export const NotificationsScreen = () => (
  <ScreenFrame
    eyebrow="Notifications"
    title="Reserved for v2"
    description="The bottom tab remains scaffolded so badge counts and notification routing can land later without changing authenticated navigation."
  >
    <View style={styles.card}>
      <Text style={styles.cardBody}>Follow events, saved-post reminders, moderation notices, and affiliate conversion moments will live here later.</Text>
    </View>
  </ScreenFrame>
);

export const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
  const { signOut } = useAuthSession();
  const currentUserQuery = useCurrentUserQuery();
  const savedPostsQuery = useSavedPostsQuery();
  const currentUser = currentUserQuery.data;
  const savedPosts = savedPostsQuery.data ?? [];

  return (
    <ScreenFrame
      eyebrow="Profile"
      title={currentUser ? `@${currentUser.username}` : "Loading your profile"}
      description="Profile stats, saved posts, and account edits now come from the live user endpoints instead of the session placeholder."
      footer={<PrimaryButton label="Sign out" onPress={signOut} variant="secondary" />}
    >
      {currentUserQuery.isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
      {currentUserQuery.error ? <Text style={styles.errorText}>{currentUserQuery.error.message}</Text> : null}
      {currentUser ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bio</Text>
            <Text style={styles.cardBody}>{currentUser.bio ?? "No bio yet. Add one from edit profile."}</Text>
            <Text style={styles.cardMeta}>Joined {new Date(currentUser.created_at).toLocaleDateString("en-US")}</Text>
          </View>

          <View style={styles.statGrid}>
            <ProfileStat label="Upvotes" value={String(currentUser.total_upvotes)} />
            <ProfileStat label="Verified buys" value={String(currentUser.verified_buy_count)} />
            <ProfileStat label="Saved" value={String(savedPosts.length)} />
          </View>

          <View style={styles.inlineButtonRow}>
            <PrimaryButton label="Edit profile" onPress={() => navigation.navigate("EditProfile")} />
            <PrimaryButton label="Saved posts" onPress={() => navigation.navigate("SavedCollection")} variant="secondary" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saved preview</Text>
            {savedPostsQuery.isLoading ? <ActivityIndicator color="#FF5A36" /> : null}
            {!savedPostsQuery.isLoading && savedPosts.length === 0 ? (
              <Text style={styles.cardBody}>Nothing saved yet. Tap Save on a feed card to build your collection.</Text>
            ) : null}
            {savedPosts.slice(0, 2).map((post) => (
              <FeedPostCard
                key={post.id}
                onOpenAuthor={() => navigation.navigate("PublicProfile", { userId: post.user.id })}
                onOpenPost={() => navigation.navigate("DupeDetail", { postId: post.id })}
                post={post}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScreenFrame>
  );
};

export const SavedCollectionScreen = ({ navigation }: SavedCollectionScreenProps) => {
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const { data: categories } = useCategoryOptionsQuery();
  const savedPostsQuery = useSavedPostsQuery();
  const savedPosts = savedPostsQuery.data ?? [];
  const filteredPosts = selectedCategorySlug
    ? savedPosts.filter((post) => post.category.slug === selectedCategorySlug)
    : savedPosts;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.feedContent}
        data={filteredPosts}
        keyExtractor={(post) => post.id}
        refreshControl={<RefreshControl onRefresh={() => void savedPostsQuery.refetch()} refreshing={savedPostsQuery.isRefetching} tintColor="#FF5A36" />}
        ListHeaderComponent={
          <View style={styles.feedHeader}>
            <Text style={styles.eyebrow}>Saved collection</Text>
            <Text style={styles.feedTitle}>Posts you want to come back to</Text>
            <Text style={styles.feedDescription}>
              Saves are now persisted to the API, and removing one here updates the rest of the app optimistically.
            </Text>
            {categories ? (
              <CategoryChips
                categories={categories}
                onSelect={setSelectedCategorySlug}
                selectedCategorySlug={selectedCategorySlug}
              />
            ) : null}
            {savedPostsQuery.error ? <Text style={styles.errorText}>{savedPostsQuery.error.message}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !savedPostsQuery.isLoading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your saved collection is empty</Text>
              <Text style={styles.cardBody}>Save any dupe from the feed or detail screen to pin it here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <FeedPostCard
            onOpenAuthor={() => navigation.navigate("PublicProfile", { userId: item.user.id })}
            onOpenPost={() => navigation.navigate("DupeDetail", { postId: item.id })}
            post={item}
          />
        )}
      />
    </SafeAreaView>
  );
};

export const EditProfileScreen = ({ navigation }: EditProfileScreenProps) => {
  const currentUserQuery = useCurrentUserQuery();
  const updateCurrentUserMutation = useUpdateCurrentUserMutation();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserQuery.data) {
      return;
    }

    setAvatarUrl(currentUserQuery.data.avatar_url ?? "");
    setBio(currentUserQuery.data.bio ?? "");
    setUsername(currentUserQuery.data.username);
  }, [currentUserQuery.data]);

  const handleSave = async () => {
    setErrorMessage(null);

    try {
      await updateCurrentUserMutation.mutateAsync({
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        username: username.trim()
      });
      navigation.goBack();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update your profile.");
    }
  };

  return (
    <ScreenFrame
      eyebrow="Edit profile"
      title="Keep your dupe identity current"
      description="Changes here hit `PATCH /users/me` and refresh the live profile query."
      footer={<PrimaryButton disabled={updateCurrentUserMutation.isPending} label="Save changes" onPress={handleSave} />}
    >
      {currentUserQuery.isLoading ? <ActivityIndicator color="#FF5A36" /> : null}
      <View style={styles.card}>
        <ComposerInput label="Username" onChangeText={setUsername} placeholder="trendfinder" value={username} />
        <ComposerInput label="Avatar URL" onChangeText={setAvatarUrl} placeholder="https://cdn.example.com/avatar.jpg" value={avatarUrl} />
        <ComposerInput
          label="Bio"
          multiline
          onChangeText={setBio}
          placeholder="Tell people what kinds of dupes you trust."
          value={bio}
        />
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScreenFrame>
  );
};

export const PublicProfileScreen = ({ route }: PublicProfileScreenProps) => {
  const { session } = useAuthSession();
  const publicUserQuery = usePublicUserQuery(route.params.userId);
  const followAction = useFollowUserAction(route.params.userId);
  const isSelf = session?.userId === route.params.userId;

  return (
    <ScreenFrame
      eyebrow="Public profile"
      title={publicUserQuery.data ? `@${publicUserQuery.data.username}` : "Loading creator"}
      description="This screen now resolves real creator stats and supports optimistic follow toggles from mobile."
      footer={
        !isSelf ? (
          <PrimaryButton
            disabled={followAction.isWorking}
            label={followAction.isFollowing ? "Following" : "Follow creator"}
            onPress={followAction.toggleFollow}
            variant={followAction.isFollowing ? "secondary" : "primary"}
          />
        ) : undefined
      }
    >
      {publicUserQuery.isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
      {publicUserQuery.error ? <Text style={styles.errorText}>{publicUserQuery.error.message}</Text> : null}
      {publicUserQuery.data ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bio</Text>
            <Text style={styles.cardBody}>{publicUserQuery.data.bio ?? "This creator has not added a bio yet."}</Text>
          </View>

          <View style={styles.statGrid}>
            <ProfileStat label="Total upvotes" value={String(publicUserQuery.data.total_upvotes)} />
            <ProfileStat label="Verified buys" value={String(publicUserQuery.data.verified_buy_count)} />
            <ProfileStat label="Tier" value={formatTier(publicUserQuery.data.contributor_tier)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile activity</Text>
            <Text style={styles.cardBody}>Joined {new Date(publicUserQuery.data.created_at).toLocaleDateString("en-US")}</Text>
            <Text style={styles.cardBody}>Last active {new Date(publicUserQuery.data.last_active_at).toLocaleDateString("en-US")}</Text>
          </View>
        </>
      ) : null}
    </ScreenFrame>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F8EFE6",
    flex: 1
  },
  feedContent: {
    backgroundColor: "#F8EFE6",
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  feedHeader: {
    gap: 16
  },
  eyebrow: {
    color: "#A64421",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  feedTitle: {
    color: "#22170F",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 38
  },
  feedDescription: {
    color: "#5E4D41",
    fontSize: 16,
    lineHeight: 24
  },
  inlineRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineButtonRow: {
    gap: 12
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  feedTab: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  feedTabActive: {
    backgroundColor: "#FF5A36",
    borderColor: "#FF5A36"
  },
  feedTabLabel: {
    color: "#5E4D41",
    fontSize: 14,
    fontWeight: "700"
  },
  feedTabLabelActive: {
    color: "#FFF9F2"
  },
  categoryFilterChip: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  categoryFilterChipActive: {
    backgroundColor: "#22170F",
    borderColor: "#22170F"
  },
  categoryFilterLabel: {
    color: "#5E4D41",
    fontSize: 14,
    fontWeight: "700"
  },
  categoryFilterLabelActive: {
    color: "#FFF9F2"
  },
  card: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  cardPressed: {
    transform: [{ scale: 0.99 }]
  },
  cardEyebrow: {
    color: "#A64421",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#22170F",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24
  },
  cardBody: {
    color: "#5E4D41",
    fontSize: 15,
    lineHeight: 22
  },
  cardMeta: {
    color: "#7A6656",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20
  },
  comparisonCard: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 20
  },
  comparisonColumn: {
    backgroundColor: "#FFF4EC",
    borderRadius: 20,
    flex: 1,
    gap: 8,
    padding: 16
  },
  comparisonLabel: {
    color: "#A64421",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  comparisonTitle: {
    color: "#22170F",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22
  },
  priceText: {
    color: "#22170F",
    fontSize: 18,
    fontWeight: "900"
  },
  postActionWrap: {
    gap: 12
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  socialChip: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  socialChipActive: {
    backgroundColor: "#FF5A36",
    borderColor: "#FF5A36"
  },
  socialChipDisabled: {
    opacity: 0.5
  },
  socialChipPressed: {
    transform: [{ scale: 0.98 }]
  },
  socialChipLabel: {
    color: "#5E4D41",
    fontSize: 13,
    fontWeight: "800"
  },
  socialChipLabelActive: {
    color: "#FFF9F2"
  },
  authorLink: {
    gap: 4
  },
  authorLinkLabel: {
    color: "#22170F",
    fontSize: 15,
    fontWeight: "800"
  },
  authorLinkMeta: {
    color: "#7A6656",
    fontSize: 13,
    lineHeight: 19
  },
  feedFooter: {
    alignItems: "center",
    paddingBottom: 16,
    paddingTop: 8
  },
  footerText: {
    color: "#7A6656",
    fontSize: 14,
    fontWeight: "600"
  },
  errorText: {
    color: "#A32218",
    fontSize: 15,
    lineHeight: 22
  },
  optionList: {
    gap: 12
  },
  optionCard: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  optionCardActive: {
    backgroundColor: "#22170F",
    borderColor: "#22170F"
  },
  optionTitle: {
    color: "#22170F",
    fontSize: 18,
    fontWeight: "800"
  },
  optionTitleActive: {
    color: "#FFF9F2"
  },
  optionBody: {
    color: "#5E4D41",
    fontSize: 15,
    lineHeight: 22
  },
  optionBodyActive: {
    color: "#F6E8DC"
  },
  fieldGroup: {
    gap: 8
  },
  inputLabel: {
    color: "#22170F",
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderRadius: 18,
    borderWidth: 1,
    color: "#22170F",
    fontSize: 15,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  monoText: {
    color: "#5E4D41",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20
  },
  statGrid: {
    flexDirection: "row",
    gap: 12
  },
  statTile: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 18
  },
  statValue: {
    color: "#22170F",
    fontSize: 20,
    fontWeight: "900"
  },
  statLabel: {
    color: "#7A6656",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  }
});
