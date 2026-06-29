import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/facebook/callback`;

async function exchangeCode(code: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${FB_APP_SECRET}&code=${code}`
  );
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function getLongLivedToken(shortToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortToken}`
  );
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function fetchUserInfo(token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${token}`
  );
  return res.json() as Promise<{ id: string; name: string }>;
}

async function fetchPages(token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${token}`
  );
  const data = await res.json() as { data: { id: string; name: string; access_token: string }[] };
  return (data.data || []).map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}

async function fetchGroups(token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/groups?fields=id,name&access_token=${token}`
  );
  const data = await res.json() as { data: { id: string; name: string }[] };
  return data.data || [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const encodedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard/settings?error=facebook_denied", process.env.NEXTAUTH_URL!));
  }

  let tenantId: string;
  try {
    const state = JSON.parse(Buffer.from(encodedState!, "base64").toString());
    tenantId = state.tenantId;
  } catch {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  try {
    const { access_token: shortToken } = await exchangeCode(code);
    const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken);

    const userInfo = await fetchUserInfo(longToken);
    const pages = await fetchPages(longToken);
    let groups: { id: string; name: string }[] = [];
    try {
      groups = await fetchGroups(longToken);
    } catch {
      // groups permission not available — user can still post to pages & marketplace
    }

    const existing = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformUserId, userInfo.id),
    });

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    if (existing) {
      await db
        .update(platformConnections)
        .set({
          accessToken: longToken,
          tokenExpiresAt: expiresAt,
          platformUserName: userInfo.name,
          metadata: { pages, groups },
        })
        .where(eq(platformConnections.id, existing.id));
    } else {
      await db.insert(platformConnections).values({
        tenantId,
        platform: "facebook",
        accessToken: longToken,
        tokenExpiresAt: expiresAt,
        platformUserId: userInfo.id,
        platformUserName: userInfo.name,
        metadata: { pages, groups },
      });
    }

    return NextResponse.redirect(new URL("/dashboard/settings?connected=facebook", process.env.NEXTAUTH_URL!));
  } catch (err) {
    console.error("Facebook callback error:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?error=facebook_failed", process.env.NEXTAUTH_URL!));
  }
}
