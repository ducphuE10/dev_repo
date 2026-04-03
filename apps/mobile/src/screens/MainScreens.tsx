import { useState } from "react";

import type { FeedTab } from "@dupe-hunt/types";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { PrimaryButton } from "../components/PrimaryButton.tsx";
import { ScreenFrame } from "../components/ScreenFrame.tsx";
import { useCategoryOptionsQuery } from "../hooks/useCategoryOptionsQuery.ts";
import { useFeedPreviewQuery } from "../hooks/useFeedPreviewQuery.ts";
import { mobileAppShell } from "../lib/api.ts";

const feedTabs: FeedTab[] = ["for_you", "trending", "new"];

const formatFeedTab = (tab: FeedTab) => tab.replace("_", " ").replace(/^\w/, (character) => character.toUpperCase());

export const FeedScreen = () => {
  const [activeTab, setActiveTab] = useState<FeedTab>("for_you");
  const { data: categories } = useCategoryOptionsQuery();
  const { data: posts, error, isLoading } = useFeedPreviewQuery(activeTab);
  const { session } = useAuthSession();
  const selectedCategories = categories?.filter((category) => session?.selectedCategoryIds.includes(category.id));

  return (
    <ScreenFrame
      eyebrow="Home"
      title="The feed shell is live"
      description="React Query already loads the categories and preview feed from the API, while the UI stays thin enough for real feed behavior to replace these placeholders cleanly."
    >
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
        <Text style={styles.cardTitle}>Selected categories</Text>
        <Text style={styles.cardBody}>
          {selectedCategories && selectedCategories.length > 0
            ? selectedCategories.map((category) => category.name).join(" • ")
            : "No category sync yet. The onboarding shell stores local picks until real profile wiring lands."}
        </Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
      {posts?.map((post) => (
        <View key={post.id} style={styles.card}>
          <Text style={styles.cardEyebrow}>
            {post.category.icon ?? "✨"} {post.category.name}
          </Text>
          <Text style={styles.cardTitle}>
            {post.original_product_name} → {post.dupe_product_name}
          </Text>
          <Text style={styles.cardBody}>{post.review_text ?? "Community review copy will appear here once post content is seeded."}</Text>
          <Text style={styles.cardMeta}>
            @{post.user.username} • saves ${post.price_saved ?? 0} • {post.upvote_count} upvotes
          </Text>
        </View>
      ))}
      {posts && posts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feed is empty</Text>
          <Text style={styles.cardBody}>The navigation shell is ready. Seed data or real users can populate this tab next.</Text>
        </View>
      ) : null}
    </ScreenFrame>
  );
};

export const SearchScreen = () => {
  const { data: categories } = useCategoryOptionsQuery();

  return (
    <ScreenFrame
      eyebrow="Search"
      title="Category-led discovery"
      description="Search result flows are intentionally deferred, but the shell already has a dedicated tab and shared data hooks for category-aware querying."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ready for ST-9</Text>
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
    description="The tab exists now so later media capture, form, preview, and receipt verification screens can slot into the main shell without changing the navigator tree."
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
    description="The bottom tab is scaffolded now so badge counts and notification routing can be added later without reshaping authenticated navigation."
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
      description="Auth token storage lives in SecureStore, while session state and actions stay centralized in the provider instead of leaking into screens."
      footer={<PrimaryButton label="Sign out" onPress={signOut} variant="secondary" />}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shell status</Text>
        <Text style={styles.cardBody}>Auth mode: {session?.mode ?? "preview"}</Text>
        <Text style={styles.cardBody}>API base URL: {mobileAppShell.apiBaseUrl}</Text>
        <Text style={styles.cardBody}>Supabase configured: {mobileAppShell.hasSupabaseAnonKey ? "yes" : "no"}</Text>
      </View>
    </ScreenFrame>
  );
};

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: "row",
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
  card: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 20
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
  errorText: {
    color: "#A32218",
    fontSize: 15,
    lineHeight: 22
  }
});
