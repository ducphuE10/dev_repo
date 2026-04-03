import { useState } from "react";

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
      description="Categories come from the live API, and your picks are written back to `/users/me/categories` before the app opens."
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await completeOnboarding();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenFrame
      eyebrow="Ready"
      title="Your feed is personalized"
      description={`Selected ${draftCategoryIds.length} categories. Saving here syncs your onboarding picks to the API and unlocks the live feed.`}
      footer={<PrimaryButton disabled={isSubmitting} label="Enter the app" onPress={handleComplete} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>What happens next</Text>
        <Text style={styles.summaryBody}>Your category picks are persisted to the profile.</Text>
        <Text style={styles.summaryBody}>For You opens filtered to those categories.</Text>
        <Text style={styles.summaryBody}>You can scroll into live post detail screens right away.</Text>
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {isSubmitting ? <ActivityIndicator color="#FF5A36" /> : null}
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
