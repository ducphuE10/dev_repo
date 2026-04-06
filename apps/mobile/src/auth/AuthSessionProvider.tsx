import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import * as SecureStore from "expo-secure-store";

import type { ApiAuthResponse } from "@dupe-hunt/types";

import { createApiClient } from "../lib/api.ts";

const authStorageKey = "dupe-hunt.mobile.session";

export interface MobileAuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  mode: "server";
  hasCompletedOnboarding: boolean;
  selectedCategoryIds: number[];
}

interface AuthSessionContextValue {
  isHydrated: boolean;
  draftCategoryIds: number[];
  session: MobileAuthSession | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; username: string }) => Promise<void>;
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

const hydrateServerSession = async (authResponse: ApiAuthResponse): Promise<MobileAuthSession> => {
  const apiClient = createApiClient({
    accessToken: authResponse.token
  });
  const [currentUserResponse, userCategoriesResponse] = await Promise.all([
    apiClient.getCurrentUser(),
    apiClient.listUserCategories()
  ]);
  const selectedCategoryIds = userCategoriesResponse.categories.map((category) => category.id);

  return {
    accessToken: authResponse.token,
    refreshToken: authResponse.refresh_token,
    userId: currentUserResponse.user.id,
    username: currentUserResponse.user.username,
    mode: "server",
    hasCompletedOnboarding: selectedCategoryIds.length > 0,
    selectedCategoryIds
  };
};

export const AuthSessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<MobileAuthSession | null>(null);
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;

    const hydrate = async () => {
      const storedSession = await readStoredSession();

      if (!storedSession) {
        if (isActive) {
          setSession(null);
          setDraftCategoryIds([]);
          setIsHydrated(true);
        }

        return;
      }

      try {
        const authResponse = await createApiClient().refresh(storedSession.refreshToken);
        const refreshedSession = await hydrateServerSession(authResponse);

        if (!isActive) {
          return;
        }

        setSession(refreshedSession);
        setDraftCategoryIds(refreshedSession.selectedCategoryIds);
        await persistStoredSession(refreshedSession);
      } catch {
        if (!isActive) {
          return;
        }

        setSession(null);
        setDraftCategoryIds([]);
        await persistStoredSession(null);
      } finally {
        if (isActive) {
          setIsHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      isActive = false;
    };
  }, []);

  const writeSession = async (nextSession: MobileAuthSession | null) => {
    setSession(nextSession);
    setDraftCategoryIds(nextSession?.selectedCategoryIds ?? []);
    await persistStoredSession(nextSession);
  };

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    const authResponse = await createApiClient().login({
      email,
      password
    });
    const nextSession = await hydrateServerSession(authResponse);

    await writeSession(nextSession);
  };

  const register = async ({ email, password, username }: { email: string; password: string; username: string }) => {
    const authResponse = await createApiClient().register({
      email,
      password,
      username
    });
    const nextSession = await hydrateServerSession(authResponse);

    await writeSession(nextSession);
  };

  const completeOnboarding = async () => {
    if (!session) {
      return;
    }

    const response = await createApiClient({
      accessToken: session.accessToken
    }).replaceUserCategories(draftCategoryIds);
    const selectedCategoryIds = response.categories.map((category) => category.id);

    await writeSession({
      ...session,
      hasCompletedOnboarding: true,
      selectedCategoryIds
    });
  };

  const signOut = async () => {
    const activeSession = session;

    try {
      if (activeSession) {
        await createApiClient({
          accessToken: activeSession.accessToken
        }).logout(activeSession.refreshToken);
      }
    } catch {
      // Clearing the local session still takes precedence if the server-side logout fails.
    }

    await writeSession(null);
  };

  return (
    <AuthSessionContext.Provider
      value={{
        isHydrated,
        draftCategoryIds,
        session,
        signIn,
        register,
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
