import { useAuthSession } from "../auth/AuthSessionProvider.tsx";
import { createApiClient } from "../lib/api.ts";

export const useApiClient = (options?: { requireServerAuth?: boolean }) => {
  const { session } = useAuthSession();
  const accessToken =
    options?.requireServerAuth && session?.mode === "server" ? session.accessToken : options?.requireServerAuth ? null : null;

  return createApiClient({
    accessToken,
    authMode: session?.mode ?? "preview"
  });
};
