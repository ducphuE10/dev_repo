import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { PrimaryButton } from "../components/PrimaryButton.tsx";
import { ScreenFrame } from "../components/ScreenFrame.tsx";
import { useCategoryOptionsQuery } from "../hooks/useCategoryOptionsQuery.ts";

interface SimpleNavigation {
  goBack: () => void;
  navigate: (routeName: string) => void;
}

interface OnboardingScreenProps {
  navigation: SimpleNavigation;
}

export const CategorySelectScreen = ({ navigation }: OnboardingScreenProps) => {
  const { data, error, isLoading } = useCategoryOptionsQuery();
  const { draftCategoryIds, session, setDraftCategoryIds } = useAuthSession();
  const selectedCategoryIds = draftCategoryIds.length > 0 ? draftCategoryIds : session?.selectedCategoryIds ?? [];

  const toggleCategory = (categoryId: number) => {
    const nextSelection = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((item) => item !== categoryId)
      : [...selectedCategoryIds, categoryId];

    setDraftCategoryIds(nextSelection);
  };

  return (
    <ScreenFrame
      eyebrow="Onboarding"
      title="Teach the feed your taste"
      description="Categories come from the live API. Selection is persisted in the local auth shell now, then upgraded to server-backed preference sync in the next mobile iteration."
      footer={<PrimaryButton disabled={selectedCategoryIds.length === 0} label="Continue" onPress={() => navigation.navigate("OnboardingComplete")} />}
    >
      {isLoading ? <ActivityIndicator color="#FF5A36" size="large" /> : null}
      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
      <View style={styles.chipGrid}>
        {data?.map((category) => {
          const isSelected = selectedCategoryIds.includes(category.id);

          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              onPress={() => toggleCategory(category.id)}
              style={[styles.categoryChip, isSelected ? styles.categoryChipSelected : undefined]}
            >
              <Text style={styles.categoryEmoji}>{category.icon ?? "✨"}</Text>
              <Text style={[styles.categoryText, isSelected ? styles.categoryTextSelected : undefined]}>{category.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenFrame>
  );
};

export const OnboardingCompleteScreen = ({ navigation }: OnboardingScreenProps) => {
  const { completeOnboarding, draftCategoryIds } = useAuthSession();

  return (
    <ScreenFrame
      eyebrow="Ready"
      title="Your shell is wired"
      description={`Selected ${draftCategoryIds.length} categories. The next mobile iteration can now focus on real auth, feed behavior, and onboarding API sync instead of app plumbing.`}
      footer={<PrimaryButton label="Enter the app" onPress={completeOnboarding} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>What is already in place</Text>
        <Text style={styles.summaryBody}>SecureStore-backed auth session hydration</Text>
        <Text style={styles.summaryBody}>Centralized stack and tab navigation</Text>
        <Text style={styles.summaryBody}>React Query client and reusable API helpers</Text>
      </View>
      <PrimaryButton label="Back to categories" onPress={navigation.goBack} variant="secondary" />
    </ScreenFrame>
  );
};

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  categoryChip: {
    alignItems: "center",
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    flexBasis: "47%",
    gap: 8,
    minHeight: 104,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  categoryChipSelected: {
    backgroundColor: "#FF5A36",
    borderColor: "#FF5A36"
  },
  categoryEmoji: {
    fontSize: 28
  },
  categoryText: {
    color: "#22170F",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  },
  categoryTextSelected: {
    color: "#FFF9F2"
  },
  errorText: {
    color: "#A32218",
    fontSize: 15,
    lineHeight: 22
  },
  summaryCard: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  summaryTitle: {
    color: "#22170F",
    fontSize: 20,
    fontWeight: "800"
  },
  summaryBody: {
    color: "#5E4D41",
    fontSize: 15,
    lineHeight: 22
  }
});
