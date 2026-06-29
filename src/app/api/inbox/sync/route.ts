import { auth } from "@/lib/auth";
import { db } from "@/db";
import { platformConnections, conversations, messages, products, tenants } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateAutoReply } from "@/lib/ai";

async function refreshPages(userToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${userToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Failed to fetch pages");
  return (data.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
  }));
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clean up stale AI auto-replies that were stored without a Facebook message_id
  // (from a previous bug — these were never actually delivered to the user)
  await db.delete(messages).where(
    and(
      eq(messages.direction, "outbound"),
      eq(messages.senderName, "AI Assistant"),
      isNull(messages.platformMessageId),
    )
  );

  const connections = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.tenantId, session.user.tenantId),
      eq(platformConnections.platform, "facebook"),
      eq(platformConnections.enabled, true)
    ),
  });

  let totalConvs = 0;
  let totalMsgs = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, conn.tenantId),
    });
    const businessName = tenant?.name || "Our Business";

    let pages: { id: string; name: string; accessToken: string }[] =
      (conn.metadata as any)?.pages || [];

    if (pages.length === 0 && conn.accessToken) {
      try {
        pages = await refreshPages(conn.accessToken);
        await db.update(platformConnections)
          .set({ metadata: { ...(conn.metadata as any), pages } })
          .where(eq(platformConnections.id, conn.id));
      } catch (err) {
        errors.push(`Could not refresh pages: ${String(err)}`);
        continue;
      }
    }

    if (pages.length === 0) {
      errors.push("No Facebook Pages found. Create a page first, then sync again.");
      continue;
    }

    for (const page of pages) {
      const pageToken = page.accessToken;
      if (!pageToken) {
        errors.push(`No token for page ${page.name}`);
        continue;
      }

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}/conversations?fields=messages.limit(1){message,from,created_time}&access_token=${pageToken}&limit=50`
        );
        const data = await res.json();

        if (!res.ok) {
          errors.push(`Facebook error for page ${page.name}: ${data.error?.message}`);
          continue;
        }

        const fbConvs: any[] = data.data || [];

        if (fbConvs.length === 0) {
          errors.push(`No conversations found for page "${page.name}" — send a message to the page first`);
        }

        for (const fbConv of fbConvs) {
          const fbMsgs: any[] = fbConv.messages?.data || [];
          if (fbMsgs.length === 0) continue;

          const lastMsg = fbMsgs[fbMsgs.length - 1];
          const firstMsg = fbMsgs[0];
          const customer = firstMsg?.from;

          const existing = await db.query.conversations.findFirst({
            where: and(
              eq(conversations.platformConnectionId, conn.id),
              eq(conversations.pageId, page.id),
              eq(conversations.customerId, customer?.id)
            ),
          });

          let convId: string;
          let convCustomerId = customer?.id;
          const msgText = (msg: any) =>
            typeof msg?.message === "string" ? msg.message : msg?.message?.text || "";

          if (existing) {
            convId = existing.id;
            convCustomerId = existing.customerId || customer?.id;
            await db.update(conversations)
              .set({
                pageId: existing.pageId || page.id,
                lastMessagePreview: msgText(lastMsg).slice(0, 100),
                lastMessageAt: lastMsg?.created_time ? new Date(lastMsg.created_time) : new Date(),
              })
              .where(eq(conversations.id, existing.id));
          } else {
            const [newConv] = await db.insert(conversations).values({
              tenantId: session.user.tenantId!,
              platformConnectionId: conn.id,
              platformConversationId: fbConv.id,
              pageId: page.id,
              customerName: customer?.name || "Unknown",
              customerId: customer?.id,
              lastMessagePreview: msgText(lastMsg).slice(0, 100),
              platform: "facebook",
              lastMessageAt: lastMsg?.created_time ? new Date(lastMsg.created_time) : new Date(),
              status: "open",
            }).returning();
            convId = newConv.id;
            totalConvs++;
          }

          for (const fbMsg of fbMsgs) {
            if (!fbMsg.id) continue;
            const msgExists = await db.query.messages.findFirst({
              where: eq(messages.platformMessageId, fbMsg.id),
            });
            if (msgExists) continue;

            const text = msgText(fbMsg);
            const isInbound = fbMsg.from?.id !== page.id;

            await db.insert(messages).values({
              conversationId: convId,
              platformMessageId: fbMsg.id,
              content: text,
              senderName: fbMsg.from?.name || "Unknown",
              direction: isInbound ? "inbound" : "outbound",
              createdAt: fbMsg.created_time ? new Date(fbMsg.created_time) : new Date(),
            });
            totalMsgs++;

            if (isInbound && text) {
              const hasHumanReply = await db.query.messages.findFirst({
                where: and(
                  eq(messages.conversationId, convId),
                  eq(messages.direction, "outbound"),
                  eq(messages.senderName, "You"),
                ),
              });
              if (!hasHumanReply) {
                const inventory = await db.query.products.findMany({
                  where: eq(products.tenantId, session.user.tenantId!),
                });
                const reply = await generateAutoReply(
                  text,
                  fbMsg.from?.name || "Customer",
                  inventory.map((p) => ({
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    stockStatus: p.stockStatus,
                    images: p.images,
                  })),
                  businessName
                );
                if (reply && page.accessToken && convCustomerId) {
                  const fbRes = await fetch(
                    `https://graph.facebook.com/v21.0/me/messages?access_token=${page.accessToken}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        recipient: { id: convCustomerId },
                        message: { text: reply },
                        messaging_type: "RESPONSE",
                      }),
                    }
                  );
                  const fbData = await fbRes.json();
                  if (fbRes.ok && fbData.message_id) {
                    await db.insert(messages).values({
                      conversationId: convId,
                      platformMessageId: fbData.message_id,
                      content: reply,
                      senderName: "AI Assistant",
                      direction: "outbound",
                      createdAt: new Date(),
                    });
                    await db.update(conversations)
                      .set({
                        lastMessagePreview: reply.slice(0, 100),
                        lastMessageAt: new Date(),
                      })
                      .where(eq(conversations.id, convId));
                  } else {
                    errors.push(`Facebook send failed: ${fbData.error?.message || JSON.stringify(fbData)}`);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        errors.push(`Failed for page ${page.name}: ${String(err)}`);
      }
    }
  }

  return NextResponse.json({
    synced: true,
    conversations: totalConvs,
    messages: totalMsgs,
    errors: errors.length > 0 ? errors : undefined,
  });
}
