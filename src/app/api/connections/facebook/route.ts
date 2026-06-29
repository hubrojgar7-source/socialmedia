import { auth } from "@/lib/auth";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.delete(platformConnections)
    .where(and(
      eq(platformConnections.tenantId, session.user.tenantId),
      eq(platformConnections.platform, "facebook")
    ));

  return NextResponse.json({ disconnected: true });
}
