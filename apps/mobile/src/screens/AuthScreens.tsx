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

interface AuthField {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address";
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (value: string) => void;
}

const AuthForm = ({
  ctaLabel,
  fields,
  helper,
  onSubmit,
  title
}: {
  ctaLabel: string;
  fields: AuthField[];
  helper: string;
  onSubmit: () => Promise<void>;
  title: string;
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenFrame eyebrow="Sign in" title={title} description={helper}>
      <View style={styles.formCard}>
        {fields.map((field) => (
          <View key={field.label} style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>{field.label}</Text>
            <TextInput
              autoCapitalize={field.autoCapitalize ?? "none"}
              autoCorrect={field.autoCorrect ?? false}
              keyboardType={field.keyboardType}
              onChangeText={field.onChangeText}
              placeholder={field.placeholder}
              placeholderTextColor="#8C7768"
              secureTextEntry={field.secureTextEntry}
              style={styles.input}
              value={field.value}
            />
          </View>
        ))}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    description="Sign in to sync category picks, browse the live feed, and save your place across sessions."
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
        Real review clips, category-first discovery, and feed ranking that already comes from the Dupe Hunt API.
      </Text>
    </View>
  </ScreenFrame>
);

export const LoginScreen = () => {
  const { signIn } = useAuthSession();
  const [email, setEmail] = useState("zoe@example.com");
  const [password, setPassword] = useState("password123");

  return (
    <AuthForm
      ctaLabel="Log in"
      helper="This talks directly to the Fastify auth endpoints and restores the session from SecureStore on later app launches."
      fields={[
        {
          label: "Email",
          placeholder: "zoe@example.com",
          keyboardType: "email-address",
          value: email,
          onChangeText: setEmail
        },
        {
          label: "Password",
          placeholder: "At least 8 characters",
          secureTextEntry: true,
          value: password,
          onChangeText: setPassword
        }
      ]}
      onSubmit={() =>
        signIn({
          email,
          password
        })
      }
      title="Log in to Dupe Hunt"
    />
  );
};

export const RegisterScreen = () => {
  const { register } = useAuthSession();
  const [username, setUsername] = useState("trendfinder");
  const [email, setEmail] = useState("trendfinder@example.com");
  const [password, setPassword] = useState("password123");

  return (
    <AuthForm
      ctaLabel="Create account"
      helper="New accounts go through the live register endpoint first, then straight into category onboarding so the for-you feed can personalize immediately."
      fields={[
        {
          label: "Username",
          placeholder: "trendfinder",
          value: username,
          onChangeText: setUsername
        },
        {
          label: "Email",
          placeholder: "trendfinder@example.com",
          keyboardType: "email-address",
          value: email,
          onChangeText: setEmail
        },
        {
          label: "Password",
          placeholder: "At least 8 characters",
          secureTextEntry: true,
          value: password,
          onChangeText: setPassword
        }
      ]}
      onSubmit={() =>
        register({
          username,
          email,
          password
        })
      }
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
  fieldGroup: {
    gap: 8
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
  },
  errorText: {
    color: "#A32218",
    fontSize: 15,
    lineHeight: 22
  }
});
