import { db } from "@/db";
import { platformConnections, conversations, messages, dailyAnalytics } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export async function syncDailyAnalytics(tenantId: string, connectionId: string, forDate?: string): Promise<void> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(eq(platformConnections.id, connectionId), eq(platformConnections.tenantId, tenantId)),
  });
  if (!connection?.accessToken) return;

  const today = forDate || new Date().toISOString().split("T")[0];
  const todayStart = new Date(today + "T00:00:00Z");
  const todayEnd = new Date(today + "T23:59:59Z");

  const convs = await db.query.conversations.findMany({
    where: and(
      eq(conversations.tenantId, tenantId),
      eq(conversations.platformConnectionId, connectionId)
    ),
    with: {
      messages: true,
    },
  });

  const newConvs = convs.filter(c => {
    const d = c.createdAt ? new Date(c.createdAt) : null;
    return d && d >= todayStart && d <= todayEnd;
  }).length;

  const msgsReceived = convs.reduce((acc, c) => {
    const msgs = (c as any).messages || [];
    return acc + msgs.filter((m: any) => m.direction === "inbound").length;
  }, 0);

  const token = connection.accessToken;
  const pages = (connection.metadata as any)?.pages || [];
  let comments = 0;
  let likes = 0;

  for (const page of pages) {
    const pageToken = page.accessToken || token;
    try {
      const feedRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/feed?fields=comments.limit(1){message},reactions.limit(1){type},created_time&limit=25&access_token=${pageToken}`
      );
      const feedData = await feedRes.json();
      if (feedData.data) {
        for (const post of feedData.data) {
          const postComments = post.comments?.data || [];
          const postReactions = post.reactions?.data || [];
          comments += postComments.length;
          likes += postReactions.filter((r: any) => r.type === "LIKE").length;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch feed for analytics", page.id);
    }
  }

  const existing = await db.query.dailyAnalytics.findFirst({
    where: and(
      eq(dailyAnalytics.tenantId, tenantId),
      eq(dailyAnalytics.platformConnectionId, connectionId),
      eq(dailyAnalytics.date, today)
    ),
  });

  if (existing) {
    await db.update(dailyAnalytics)
      .set({
        newConversations: newConvs,
        messagesReceived: msgsReceived,
        comments,
        likes,
        updatedAt: new Date(),
      })
      .where(eq(dailyAnalytics.id, existing.id));
  } else {
    await db.insert(dailyAnalytics).values({
      tenantId,
      platformConnectionId: connectionId,
      date: today,
      newConversations: newConvs,
      messagesReceived: msgsReceived,
      comments,
      likes,
      sales: 0,
      revenue: 0,
    });
  }
}
