import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const FB_APP_ID = process.env.FACEBOOK_APP_ID!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/facebook/callback`;
const SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "pages_messaging",
  "public_profile",
].join(",");

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  const state = JSON.stringify({ tenantId: session.user.tenantId });

  const fbUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  fbUrl.searchParams.set("client_id", FB_APP_ID);
  fbUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  fbUrl.searchParams.set("scope", SCOPES);
  fbUrl.searchParams.set("response_type", "code");
  fbUrl.searchParams.set("state", Buffer.from(state).toString("base64"));

  return NextResponse.redirect(fbUrl.toString());
}
