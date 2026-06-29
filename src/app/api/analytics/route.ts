import { auth } from "@/lib/auth";
import { db } from "@/db";
import { dailyAnalytics, platformConnections } from "@/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
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
    where: and(
      eq(dailyAnalytics.tenantId, session.user.tenantId),
      gte(dailyAnalytics.date, startStr)
    ),
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const forDate = body.date as string | undefined;

  const connections = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.tenantId, session.user.tenantId),
      eq(platformConnections.platform, "facebook"),
      eq(platformConnections.enabled, true)
    ),
  });

  for (const conn of connections) {
    await syncDailyAnalytics(session.user.tenantId, conn.id, forDate);
  }

  return NextResponse.json({ synced: true });
}
