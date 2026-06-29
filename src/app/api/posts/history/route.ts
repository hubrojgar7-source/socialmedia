import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, postDestinations } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.tenantId, session.user.tenantId),
    orderBy: desc(posts.createdAt),
  });

  const postIds = allPosts.map((p) => p.id);

  let allDests: any[] = [];
  if (postIds.length > 0) {
    allDests = await db.query.postDestinations.findMany({
      where: inArray(postDestinations.postId, postIds),
    });
  }

  const destMap: Record<string, any[]> = {};
  for (const dest of allDests) {
    if (!destMap[dest.postId]) destMap[dest.postId] = [];
    destMap[dest.postId].push(dest);
  }

  const result = allPosts.map((p) => ({
    ...p,
    destinations: destMap[p.id] || [],
  }));

  return NextResponse.json(result);
}
