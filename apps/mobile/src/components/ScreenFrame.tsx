import type { PropsWithChildren, ReactNode } from "react";

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenFrameProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  description?: string;
  footer?: ReactNode;
}

export const ScreenFrame = ({ children, description, eyebrow, footer, title }: ScreenFrameProps) => (
  <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
    <View pointerEvents="none" style={styles.glowOne} />
    <View pointerEvents="none" style={styles.glowTwo} />

    <ScrollView bounces={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      <View style={styles.body}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F8EFE6",
    flex: 1
  },
  content: {
    flexGrow: 1,
    gap: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  header: {
    gap: 10,
    paddingTop: 8
  },
  eyebrow: {
    color: "#A64421",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: "#22170F",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 38
  },
  description: {
    color: "#5E4D41",
    fontSize: 16,
    lineHeight: 24
  },
  body: {
    gap: 16
  },
  footer: {
    marginTop: "auto"
  },
  glowOne: {
    backgroundColor: "#FFD7B5",
    borderRadius: 160,
    height: 220,
    opacity: 0.45,
    position: "absolute",
    right: -60,
    top: -20,
    width: 220
  },
  glowTwo: {
    backgroundColor: "#FFC1BA",
    borderRadius: 160,
    bottom: 100,
    height: 180,
    left: -70,
    opacity: 0.35,
    position: "absolute",
    width: 180
  }
});
