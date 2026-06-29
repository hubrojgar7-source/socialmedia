import { auth } from "@/lib/auth";
import { db } from "@/db";
import { messages, conversations, platformConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, id),
      eq(conversations.tenantId, session.user.tenantId)
    ),
  });

  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Send reply to Facebook
  if (conv.pageId && conv.customerId) {
    const conn = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, conv.platformConnectionId),
    });

    if (conn) {
      const pages: any[] = (conn.metadata as any)?.pages || [];
      const page = pages.find((p: any) => p.id === conv.pageId);

      if (page?.accessToken) {
        const fbRes = await fetch(
          `https://graph.facebook.com/v21.0/me/messages?access_token=${page.accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: conv.customerId },
              message: { text: content },
              messaging_type: "RESPONSE",
            }),
          }
        );

        const fbData = await fbRes.json();
        if (!fbRes.ok) {
          return NextResponse.json({
            error: `Facebook send failed: ${fbData.error?.message || "Unknown error"}`,
          }, { status: 400 });
        }
      }
    }
  }

  // Store locally
  const msg = await db.insert(messages).values({
    conversationId: id,
    content,
    senderName: "You",
    direction: "outbound",
  }).returning();

  await db.update(conversations)
    .set({
      lastMessagePreview: content.slice(0, 100),
      lastMessageAt: new Date(),
      unreadCount: 0,
    })
    .where(eq(conversations.id, id));

  return NextResponse.json(msg[0]);
}
