import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, postDestinations } from "@/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, imageUrl, destinations } = await req.json();

  const [post] = await db
    .insert(posts)
    .values({
      tenantId: session.user.tenantId,
      title,
      description: description || "",
      imageUrls: imageUrl ? [imageUrl] : [],
      status: "publishing",
    })
    .returning();

  if (destinations?.length) {
    await db.insert(postDestinations).values(
      destinations.map((d: any) => ({
        postId: post.id,
        platformConnectionId: d.connectionId,
        destinationType: d.destinationType,
        destinationId: d.destinationId,
        destinationName: d.destinationName,
        status: "pending",
      }))
    );
  }

  return NextResponse.json(post, { status: 201 });
}
