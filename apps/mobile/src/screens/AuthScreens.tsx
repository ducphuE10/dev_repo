import { useState } from "react";

import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { PrimaryButton } from "../components/PrimaryButton.tsx";
import { ScreenFrame } from "../components/ScreenFrame.tsx";

interface SimpleNavigation {
  navigate: (routeName: string) => void;
}

interface AuthScreenProps {
  navigation: SimpleNavigation;
}

const AuthForm = ({
  ctaLabel,
  helper,
  initialValue,
  onSubmit,
  title
}: {
  ctaLabel: string;
  helper: string;
  initialValue: string;
  onSubmit: (value: string) => Promise<void>;
  title: string;
}) => {
  const [value, setValue] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await onSubmit(value);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenFrame eyebrow="Auth shell" title={title} description={helper}>
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setValue}
          placeholder="zoe_dupes"
          placeholderTextColor="#8C7768"
          style={styles.input}
          value={value}
        />
        <PrimaryButton disabled={isSubmitting} label={ctaLabel} onPress={handleSubmit} />
        {isSubmitting ? <ActivityIndicator color="#FF5A36" /> : null}
      </View>
    </ScreenFrame>
  );
};

export const WelcomeScreen = ({ navigation }: AuthScreenProps) => (
  <ScreenFrame
    eyebrow="Community dupe hunt"
    title="Affordable finds, verified by actual people"
    description="This mobile shell wires auth state, navigation, React Query, and API utilities so the real product flows can land cleanly in the next iterations."
    footer={
      <View style={styles.footer}>
        <PrimaryButton label="Create account" onPress={() => navigation.navigate("Register")} />
        <PrimaryButton label="I already have an account" onPress={() => navigation.navigate("Login")} variant="secondary" />
      </View>
    }
  >
    <View style={styles.heroCard}>
      <Text style={styles.heroStat}>GEN Z dupe radar</Text>
      <Text style={styles.heroTitle}>Warm, honest, no luxury markup.</Text>
      <Text style={styles.heroBody}>
        Real review clips, category-first discovery, and a scaffolded feed shell that already talks to the API.
      </Text>
    </View>
  </ScreenFrame>
);

export const LoginScreen = () => {
  const { signInPreview } = useAuthSession();

  return (
    <AuthForm
      ctaLabel="Enter preview shell"
      helper="Real API-backed auth lands in the next mobile iteration. For now, this persists a preview session in SecureStore so the shell can be exercised end-to-end."
      initialValue="dupefan"
      onSubmit={(username) => signInPreview({ username })}
      title="Log in to Dupe Hunt"
    />
  );
};

export const RegisterScreen = () => {
  const { signInPreview } = useAuthSession();

  return (
    <AuthForm
      ctaLabel="Create preview account"
      helper="The shell keeps screens thin and pushes auth/session state into a provider so the real register/login API calls can slot in without rewiring navigation."
      initialValue="trendfinder"
      onSubmit={(username) => signInPreview({ username })}
      title="Claim your dupe identity"
    />
  );
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 24
  },
  heroStat: {
    color: "#A64421",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: "#22170F",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28
  },
  heroBody: {
    color: "#5E4D41",
    fontSize: 16,
    lineHeight: 24
  },
  footer: {
    gap: 12
  },
  formCard: {
    backgroundColor: "#FFF9F2",
    borderColor: "#F1CFBB",
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 20
  },
  inputLabel: {
    color: "#5E4D41",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E6D4C7",
    borderRadius: 16,
    borderWidth: 1,
    color: "#22170F",
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16
  }
});
