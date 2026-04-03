import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { createApiClient } from "../lib/api.ts";

export const useApiClient = (options?: { requireAuth?: boolean }) => {
  const { session } = useAuthSession();
  const accessToken = options?.requireAuth ? session?.accessToken ?? null : session?.accessToken ?? null;

  return createApiClient({
    accessToken
  });
};
