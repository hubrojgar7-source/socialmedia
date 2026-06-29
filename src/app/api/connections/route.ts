import { auth } from "@/lib/auth";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await db.query.platformConnections.findMany({
    where: eq(platformConnections.tenantId, session.user.tenantId),
  });

  return NextResponse.json(connections);
}
