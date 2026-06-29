import { auth } from "@/lib/auth";
import { db } from "@/db";
import { customers, platformConnections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { syncFacebookCustomers } from "@/lib/analytics/syncCustomers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await db.query.customers.findMany({
    where: eq(customers.tenantId, session.user.tenantId),
    orderBy: desc(customers.lastInteractionAt),
  });

  return NextResponse.json({ customers: all });
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

  const results: { connectionId: string; added: number; updated: number }[] = [];

  for (const conn of connections) {
    const r = await syncFacebookCustomers(session.user.tenantId, conn.id);
    results.push({ connectionId: conn.id, ...r });
  }

  return NextResponse.json({ synced: results });
}
