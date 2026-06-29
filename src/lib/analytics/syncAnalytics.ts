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

  // Messages/conversations from DB
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

  // Facebook data for comments/likes
  const token = connection.accessToken;
  const pages = (connection.metadata as any)?.pages || [];
  let comments = 0;
  let likes = 0;

  const since = new Date(today + "T00:00:00Z");
  since.setDate(since.getDate() - 1); // include yesterday too for timezone safety
  const sinceUnix = Math.floor(since.getTime() / 1000);

  for (const page of pages) {
    const pageToken = page.accessToken || token;
    try {
      // Get posts with comment and reaction SUMMARIES (not limited individual items)
      const feedRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/posts?fields=comments.summary(true),reactions.summary(true),created_time&since=${sinceUnix}&limit=50&access_token=${pageToken}`
      );
      const feedData = await feedRes.json();
      if (feedData.error) {
        console.warn("Facebook API error for page", page.id, feedData.error);
        continue;
      }
      if (feedData.data) {
        for (const post of feedData.data) {
          if (post.comments?.summary?.total_count) {
            comments += post.comments.summary.total_count;
          }
          if (post.reactions?.summary?.total_count) {
            // reactions include likes, love, wow, etc. — only count LIKE type
            // We fetch actual reactions below for accurate breakdown
            likes += post.reactions.summary.total_count;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch posts for analytics on page", page.id, e);
    }

    // Also fetch actual reactions to count only LIKE type vs total reactions
    try {
      const reactRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/feed?fields=reactions.type(LIKE).limit(0).summary(total_count),created_time&since=${sinceUnix}&limit=25&access_token=${pageToken}`
      );
      const reactData = await reactRes.json();
      if (reactData.data) {
        likes = 0; // reset and count only LIKE type
        for (const post of reactData.data) {
          if (post.reactions?.summary?.total_count) {
            likes += post.reactions.summary.total_count;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch reactions for page", page.id, e);
      // fall back to the total from above
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
