import { db } from "@/db";
import { platformConnections, conversations, messages, dailyAnalytics } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export async function syncDailyAnalytics(
  tenantId: string,
  connectionId: string,
  forDate?: string
): Promise<{ error?: string }> {
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
  let totalComments = 0;
  let totalLikes = 0;

  for (const page of pages) {
    const pageToken = page.accessToken || token;

    // Fetch posts with comment and reaction SUMMARIES
    // NOTE: .limit(0).summary(total_count) is required to get accurate totals
    try {
      const url =
        `https://graph.facebook.com/v21.0/${page.id}/posts` +
        `?fields=comments.limit(0).summary(total_count),reactions.type(LIKE).limit(0).summary(total_count),created_time` +
        `&limit=50&access_token=${pageToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.warn("FB API error for page", page.id, data.error.message);
        continue;
      }
      if (!data.data) continue;
      for (const post of data.data) {
        if (post.comments?.summary?.total_count) {
          totalComments += post.comments.summary.total_count;
        }
        if (post.reactions?.summary?.total_count) {
          totalLikes += post.reactions.summary.total_count;
        }
      }
    } catch (e) {
      console.warn("FB fetch failed for page", page.id, e);
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
    comments: totalComments,
    likes: totalLikes,
    sales: 0,
    revenue: 0,
  };

  if (existing) {
    await db
      .update(dailyAnalytics)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(dailyAnalytics.id, existing.id));
  } else {
    await db
      .insert(dailyAnalytics)
      .values({ tenantId, platformConnectionId: connectionId, date: today, ...record });
  }

  return {};
}
