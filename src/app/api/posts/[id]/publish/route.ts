import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, postDestinations, platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { postToPage, postToGroup, postToMarketplace, postToProfile } from "@/lib/facebook";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const destinations = await db.query.postDestinations.findMany({
    where: eq(postDestinations.postId, post.id),
  });

  let allSuccess = true;
  let anySuccess = false;

  for (const dest of destinations) {
    const conn = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, dest.platformConnectionId),
    });
    if (!conn) continue;

    // For page destinations, use the page-specific access token, not the user token
    let token = conn.accessToken;
    let destinationId = dest.destinationId!;
    const metadata = conn.metadata as any;

    if (dest.destinationType === "page") {
      const page = metadata?.pages?.find((p: any) => p.id === dest.destinationId);
      if (page?.accessToken) {
        token = page.accessToken;
        destinationId = page.id;
      }
    } else if (dest.destinationType === "marketplace") {
      const page = metadata?.pages?.find((p: any) => p.id === dest.destinationId);
      if (page?.accessToken) {
        token = page.accessToken;
        destinationId = page.id;
      }
    } else if (dest.destinationType === "group") {
      // Groups use the user token
    }

    const message = post.title + (post.description ? `\n\n${post.description}` : "");
    const imageUrl = post.imageUrls?.[0];

    await db
      .update(postDestinations)
      .set({ status: "publishing" })
      .where(eq(postDestinations.id, dest.id));

    let result;
    switch (dest.destinationType) {
      case "page":
        result = await postToPage(destinationId, token, message, imageUrl);
        break;
      case "group":
        result = await postToGroup(dest.destinationId!, token, message, imageUrl);
        break;
      case "marketplace":
        result = await postToMarketplace(
          destinationId,
          token,
          {
            title: post.title,
            description: post.description || "",
            price: "",
            imageUrl,
          }
        );
        break;
      case "profile":
        result = await postToProfile(dest.destinationId!, token, message, imageUrl);
        break;
      default:
        result = { success: false, error: "Unknown destination type" };
    }

    await db
      .update(postDestinations)
      .set({
        status: result.success ? "published" : "failed",
        platformPostId: result.platformPostId,
        error: result.error,
      })
      .where(eq(postDestinations.id, dest.id));

    if (result.success) anySuccess = true;
    else allSuccess = false;
  }

  const finalStatus = allSuccess ? "published" : anySuccess ? "partial" : "failed";
  await db.update(posts).set({ status: finalStatus }).where(eq(posts.id, post.id));

  return NextResponse.json({ status: finalStatus });
}
