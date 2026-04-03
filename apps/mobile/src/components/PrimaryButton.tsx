import type { ReactNode } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
}

export const PrimaryButton = ({ disabled = false, icon, label, onPress, variant = "primary" }: PrimaryButtonProps) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={() => void onPress()}
    style={({ pressed }) => [
      styles.base,
      variant === "primary" ? styles.primary : styles.secondary,
      disabled ? styles.disabled : undefined,
      pressed && !disabled ? styles.pressed : undefined
    ]}
  >
    <View style={styles.row}>
      {icon}
      <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primary: {
    backgroundColor: "#FF5A36"
  },
  secondary: {
    backgroundColor: "#FFF4EC",
    borderColor: "#F1CFBB",
    borderWidth: 1
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    transform: [{ scale: 0.985 }]
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center"
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  primaryLabel: {
    color: "#FFF9F2"
  },
  secondaryLabel: {
    color: "#22170F"
  }
});
