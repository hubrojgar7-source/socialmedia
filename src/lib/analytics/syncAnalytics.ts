import { db } from "@/db";
import { platformConnections, conversations, messages, dailyAnalytics } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export async function syncDailyAnalytics(tenantId: string, connectionId: string, forDate?: string): Promise<{ error?: string }> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(eq(platformConnections.id, connectionId), eq(platformConnections.tenantId, tenantId)),
  });
  if (!connection?.accessToken) return { error: "No access token" };

  const today = forDate || new Date().toISOString().split("T")[0];
  const todayStart = new Date(today + "T00:00:00Z");
  const todayEnd = new Date(today + "T23:59:59Z");

  const convRows = await db
    .select({ id: conversations.id, createdAt: conversations.createdAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.platformConnectionId, connectionId)
      )
    );

  const convIds = convRows.map((r) => r.id);

  const newConvs = convRows.filter((c) => {
    if (!c.createdAt) return false;
    const d = new Date(c.createdAt);
    return d >= todayStart && d <= todayEnd;
  }).length;

  let msgsReceived = 0;
  if (convIds.length > 0) {
    const msgRows = await db
      .select({ direction: messages.direction })
      .from(messages)
      .where(and(inArray(messages.conversationId, convIds), eq(messages.direction, "inbound")));
    msgsReceived = msgRows.length;
  }

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
          comments += (post.comments?.data || []).length;
          likes += (post.reactions?.data || []).filter((r: any) => r.type === "LIKE").length;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch feed for analytics", page.id, e);
    }
  }

  const existing = await db.query.dailyAnalytics.findFirst({
    where: and(
      eq(dailyAnalytics.tenantId, tenantId),
      eq(dailyAnalytics.platformConnectionId, connectionId),
      eq(dailyAnalytics.date, today)
    ),
  });

  const record = {
    newConversations: newConvs,
    messagesReceived: msgsReceived,
    comments,
    likes,
    sales: 0,
    revenue: 0,
  };

  if (existing) {
    await db.update(dailyAnalytics).set({ ...record, updatedAt: new Date() }).where(eq(dailyAnalytics.id, existing.id));
  } else {
    await db.insert(dailyAnalytics).values({ tenantId, platformConnectionId: connectionId, date: today, ...record });
  }

  return {};
}
