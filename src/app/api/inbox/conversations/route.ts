import { auth } from "@/lib/auth";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db.query.conversations.findMany({
    where: eq(conversations.tenantId, session.user.tenantId),
    orderBy: desc(conversations.lastMessageAt),
  });

  return NextResponse.json(all);
}
