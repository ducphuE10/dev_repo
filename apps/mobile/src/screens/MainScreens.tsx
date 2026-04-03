import { useEffect, useMemo, useState } from "react";

import type { ApiCategory, ApiPost, FeedTab } from "@dupe-hunt/types";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { PrimaryButton } from "../components/PrimaryButton.tsx";
import { ScreenFrame } from "../components/ScreenFrame.tsx";
import { useCategoryOptionsQuery } from "../hooks/useCategoryOptionsQuery.ts";
import { useInfiniteFeedQuery, usePostDetailQuery } from "../hooks/useFeedPreviewQuery.ts";
import { mobileAppShell } from "../lib/api.ts";

const feedTabs: FeedTab[] = ["for_you", "trending", "new"];

interface FeedScreenProps {
  navigation: {
    navigate: (routeName: "DupeDetail", params: { postId: string }) => void;
  };
}

interface DupeDetailScreenProps {
  route: {
    params: {
      postId: string;
    };
  };
}

const formatFeedTab = (tab: FeedTab) => tab.replace("_", " ").replace(/^\w/, (character) => character.toUpperCase());

const buildAffiliateUrl = (postId: string) =>
  `${mobileAppShell.apiBaseUrl.replace(/\/+$/g, "")}/affiliate/go/${postId}`;

const formatMoney = (value: number | null, currency: string) => {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(value);
};

const FeedPostCard = ({
  onPress,
  post
}: {
  onPress: () => void;
  post: ApiPost;
}) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : undefined]}>
    <Text style={styles.cardEyebrow}>
      {post.category.icon ?? "✨"} {post.category.name}
    </Text>
    <Text style={styles.cardTitle}>
      {post.original_product_name} → {post.dupe_product_name}
    </Text>
    <Text style={styles.cardBody}>{post.review_text ?? "No written review yet."}</Text>
    <Text style={styles.cardMeta}>
      @{post.user.username} • save {formatMoney(post.price_saved, post.dupe_currency)} • {post.upvote_count} upvotes
    </Text>
  </Pressable>
);

const FeedCategoryChips = ({
  categories,
  selectedSlug,
  onSelect
}: {
  categories: ApiCategory[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) => (
  <View style={styles.chipRow}>
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(null)}
      style={[styles.categoryFilterChip, selectedSlug === null ? styles.categoryFilterChipActive : undefined]}
    >
      <Text style={[styles.categoryFilterLabel, selectedSlug === null ? styles.categoryFilterLabelActive : undefined]}>All</Text>
    </Pressable>
    {categories.map((category) => (
      <Pressable
        key={category.id}
        accessibilityRole="button"
        onPress={() => onSelect(category.slug)}
        style={[styles.categoryFilterChip, selectedSlug === category.slug ? styles.categoryFilterChipActive : undefined]}
      >
        <Text style={[styles.categoryFilterLabel, selectedSlug === category.slug ? styles.categoryFilterLabelActive : undefined]}>
          {category.icon ?? "✨"} {category.name}
        </Text>
      </Pressable>
    ))}
  </View>
);

export const FeedScreen = ({ navigation }: FeedScreenProps) => {
  const [activeTab, setActiveTab] = useState<FeedTab>("for_you");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const { data: categories, error: categoryError } = useCategoryOptionsQuery();
  const { session } = useAuthSession();

  const availableCategoryFilters = useMemo(() => {
    if (!categories) {
      return [];
    }

    if (activeTab !== "for_you" || session?.selectedCategoryIds.length === 0) {
      return categories;
    }

    const selectedCategoryIds = session?.selectedCategoryIds ?? [];

    return categories.filter((category) => selectedCategoryIds.includes(category.id));
  }, [activeTab, categories, session?.selectedCategoryIds]);

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
              Sign-in and onboarding now hit the live API. Your For You tab follows saved category preferences, while Trending and New can widen back out.
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
              <FeedCategoryChips
                categories={availableCategoryFilters}
                onSelect={setSelectedCategorySlug}
                selectedSlug={selectedCategorySlug}
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
        renderItem={({ item }) => <FeedPostCard onPress={() => navigation.navigate("DupeDetail", { postId: item.id })} post={item} />}
      />
    </SafeAreaView>
  );
};

export const DupeDetailScreen = ({ route }: DupeDetailScreenProps) => {
  const { data: post, error, isLoading, refetch, isRefetching } = usePostDetailQuery(route.params.postId);

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
      footer={
        post?.affiliate_link ? (
          <PrimaryButton label="Buy this dupe" onPress={handleAffiliatePress} />
        ) : undefined
      }
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
              Save {formatMoney(post.price_saved, post.dupe_currency)} • {post.upvote_count} upvotes • {post.is_verified_buy ? "Verified buy" : "Community review"}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Posted by @{post.user.username}</Text>
            <Text style={styles.cardBody}>Tier: {post.user.contributor_tier.replace("_", " ")}</Text>
            <Text style={styles.cardBody}>Verified buys: {post.user.verified_buy_count}</Text>
            <Text style={styles.cardBody}>Created: {new Date(post.created_at).toLocaleDateString("en-US")}</Text>
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
      title="Search is staged next"
      description="The browse flow is real now; search still stays intentionally thin until its dedicated mobile slice lands."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category map</Text>
        <Text style={styles.cardBody}>
          {categories?.map((category) => `${category.icon ?? "✨"} ${category.slug}`).join(" • ") ??
            "Loading category filters..."}
        </Text>
      </View>
    </ScreenFrame>
  );
};

export const PostComposerScreen = () => (
  <ScreenFrame
    eyebrow="Create"
    title="Post creation is reserved"
    description="The authenticated shell is in place now, so later media capture and publish screens can plug into a real server session."
  >
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Planned stack</Text>
      <Text style={styles.cardBody}>Format picker → capture/gallery → post form → receipt upload → preview/publish</Text>
    </View>
  </ScreenFrame>
);

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

export const ProfileScreen = () => {
  const { session, signOut } = useAuthSession();

  return (
    <ScreenFrame
      eyebrow="Profile"
      title={`@${session?.username ?? "dupefan"}`}
      description="Server-backed auth tokens live in SecureStore, while sign-out and onboarding state stay centralized in the session provider."
      footer={<PrimaryButton label="Sign out" onPress={signOut} variant="secondary" />}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session status</Text>
        <Text style={styles.cardBody}>Auth mode: {session?.mode ?? "signed-out"}</Text>
        <Text style={styles.cardBody}>Saved categories: {session?.selectedCategoryIds.length ?? 0}</Text>
        <Text style={styles.cardBody}>API base URL: {mobileAppShell.apiBaseUrl}</Text>
        <Text style={styles.cardBody}>Supabase configured: {mobileAppShell.hasSupabaseAnonKey ? "yes" : "no"}</Text>
      </View>
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
    gap: 10,
    padding: 20
  },
  cardPressed: {
    transform: [{ scale: 0.992 }]
  },
  cardEyebrow: {
    color: "#A64421",
    fontSize: 13,
    fontWeight: "800",
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
    fontWeight: "600"
  },
  comparisonCard: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 20
  },
  comparisonColumn: {
    flex: 1,
    gap: 8
  },
  comparisonLabel: {
    color: "#A64421",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  comparisonTitle: {
    color: "#22170F",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24
  },
  priceText: {
    color: "#FF5A36",
    fontSize: 18,
    fontWeight: "800"
  },
  errorText: {
    color: "#A32218",
    fontSize: 15,
    lineHeight: 22
  },
  feedFooter: {
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 8
  },
  footerText: {
    color: "#7A6656",
    fontSize: 13,
    fontWeight: "600"
  }
});
