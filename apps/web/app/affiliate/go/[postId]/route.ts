import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildApiUrl } from "../../../../src/lib/env.ts";

const webSessionCookieName = "dupehunt_web_session";

interface AffiliateRouteProps {
  params: Promise<{
    postId: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: AffiliateRouteProps) {
  const { postId } = await params;
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(webSessionCookieName)?.value?.trim();
  const sessionId = existingSessionId || randomUUID();
  const response = await fetch(buildApiUrl(`/affiliate/go/${postId}`), {
    headers: {
      "x-session-id": sessionId
    },
    redirect: "manual",
    cache: "no-store"
  });

  const location = response.headers.get("location");

  if (response.status >= 300 && response.status < 400 && location) {
    const redirectResponse = NextResponse.redirect(location, {
      status: response.status
    });

    if (!existingSessionId) {
      redirectResponse.cookies.set({
        name: webSessionCookieName,
        value: sessionId,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 90,
        path: "/",
        sameSite: "lax"
      });
    }

    return redirectResponse;
  }

  return new NextResponse("Affiliate link unavailable.", {
    status: response.status === 404 ? 404 : 502
  });
}
