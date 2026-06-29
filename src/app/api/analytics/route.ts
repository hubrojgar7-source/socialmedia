import { auth } from "@/lib/auth";
import { db } from "@/db";
import { dailyAnalytics, platformConnections } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncDailyAnalytics } from "@/lib/analytics/syncAnalytics";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  const records = await db.query.dailyAnalytics.findMany({
    where: and(eq(dailyAnalytics.tenantId, session.user.tenantId), gte(dailyAnalytics.date, startStr)),
    orderBy: desc(dailyAnalytics.date),
  });

  const totals = records.reduce(
    (acc, r) => ({
      conversations: acc.conversations + r.newConversations,
      messages: acc.messages + r.messagesReceived,
      comments: acc.comments + r.comments,
      likes: acc.likes + r.likes,
      sales: acc.sales + (r.sales || 0),
      revenue: acc.revenue + (r.revenue || 0),
    }),
    { conversations: 0, messages: 0, comments: 0, likes: 0, sales: 0, revenue: 0 }
  );

  return NextResponse.json({ records, totals });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.tenantId, session.user.tenantId),
      eq(platformConnections.platform, "facebook"),
      eq(platformConnections.enabled, true)
    ),
  });

  if (connections.length === 0) {
    return NextResponse.json({ synced: false, error: "No Facebook connections found. Connect Facebook first in Settings." });
  }

  const results: { connectionId: string; error?: string }[] = [];
  for (const conn of connections) {
    const r = await syncDailyAnalytics(session.user.tenantId, conn.id);
    results.push({ connectionId: conn.id, ...r });
  }

  const errors = results.filter((r) => r.error);
  const success = results.filter((r) => !r.error);

  return NextResponse.json({
    synced: true,
    connections: results.length,
    successCount: success.length,
    errors: errors.length > 0 ? errors.map((e) => e.error) : undefined,
  });
}
