import { auth } from "@/lib/auth";
import { db } from "@/db";
import { messages, conversations } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conv = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, id),
      eq(conversations.tenantId, session.user.tenantId)
    ),
  });

  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const all = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: asc(messages.createdAt),
  });

  return NextResponse.json(all);
}
