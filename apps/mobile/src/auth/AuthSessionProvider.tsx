import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import * as SecureStore from "expo-secure-store";

const authStorageKey = "dupe-hunt.mobile.session";

export interface MobileAuthSession {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  username: string;
  mode: "preview" | "server";
  hasCompletedOnboarding: boolean;
  selectedCategoryIds: number[];
}

interface AuthSessionContextValue {
  isHydrated: boolean;
  draftCategoryIds: number[];
  session: MobileAuthSession | null;
  signInPreview: (input: { username: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setDraftCategoryIds: (categoryIds: number[]) => void;
  completeOnboarding: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const readStoredSession = async () => {
  const stored = await SecureStore.getItemAsync(authStorageKey);

  if (!stored) {
    return null;
  }

  return JSON.parse(stored) as MobileAuthSession;
};

const persistStoredSession = async (session: MobileAuthSession | null) => {
  if (!session) {
    await SecureStore.deleteItemAsync(authStorageKey);
    return;
  }

  await SecureStore.setItemAsync(authStorageKey, JSON.stringify(session));
};

const normalizeUsername = (username: string) => {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

  if (normalized.length >= 3) {
    return normalized.slice(0, 30);
  }

  return "dupefan";
};

export const AuthSessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<MobileAuthSession | null>(null);
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      const storedSession = await readStoredSession();
      setSession(storedSession);
      setDraftCategoryIds(storedSession?.selectedCategoryIds ?? []);
      setIsHydrated(true);
    };

    void hydrate();
  }, []);

  const writeSession = async (nextSession: MobileAuthSession | null) => {
    setSession(nextSession);
    await persistStoredSession(nextSession);
  };

  const signInPreview = async ({ username }: { username: string }) => {
    const nextSession: MobileAuthSession = {
      accessToken: "preview-access-token",
      refreshToken: "preview-refresh-token",
      userId: `preview-${Date.now()}`,
      username: normalizeUsername(username),
      mode: "preview",
      hasCompletedOnboarding: false,
      selectedCategoryIds: []
    };

    setDraftCategoryIds([]);
    await writeSession(nextSession);
  };

  const completeOnboarding = async () => {
    if (!session) {
      return;
    }

    await writeSession({
      ...session,
      hasCompletedOnboarding: true,
      selectedCategoryIds: [...draftCategoryIds]
    });
  };

  const signOut = async () => {
    setDraftCategoryIds([]);
    await writeSession(null);
  };

  return (
    <AuthSessionContext.Provider
      value={{
        isHydrated,
        draftCategoryIds,
        session,
        signInPreview,
        signOut,
        setDraftCategoryIds,
        completeOnboarding
      }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
};

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
};
