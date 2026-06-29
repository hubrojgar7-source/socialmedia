import { db } from "@/db";
import { platformConnections, conversations, messages, products, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateAutoReply } from "@/lib/ai";

const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "socialmanager_verify_2026";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object !== "page") {
      return NextResponse.json({ status: "ignored" });
    }

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      const messagingEvents = entry.messaging || [];

      const conn = await db.query.platformConnections.findFirst({
        where: and(
          eq(platformConnections.platform, "facebook"),
          eq(platformConnections.enabled, true),
        ),
      });

      if (!conn) continue;
      const pages: any[] = (conn.metadata as any)?.pages || [];
      const page = pages.find((p: any) => p.id === pageId);
      if (!page?.accessToken) continue;

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, conn.tenantId),
      });
      const businessName = tenant?.name || "Our Business";

      for (const event of messagingEvents) {
        const msg = event.message;
        if (!msg?.text) continue;

        const psid = event.sender.id;
        const mid = msg.mid;
        const text = msg.text;
        const senderName = msg.sender_name || event.sender?.name || "Customer";

        const existingConv = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.platformConnectionId, conn.id),
            eq(conversations.pageId, pageId),
            eq(conversations.customerId, psid),
          ),
        });

        let convId: string;
        let convCustomerId = psid;

        if (existingConv) {
          convId = existingConv.id;
          convCustomerId = existingConv.customerId || psid;
          await db.update(conversations)
            .set({
              lastMessagePreview: text.slice(0, 100),
              lastMessageAt: new Date(),
            })
            .where(eq(conversations.id, existingConv.id));
        } else {
          const [newConv] = await db.insert(conversations).values({
            tenantId: conn.tenantId,
            platformConnectionId: conn.id,
            platformConversationId: mid,
            pageId,
            customerName: senderName,
            customerId: psid,
            lastMessagePreview: text.slice(0, 100),
            platform: "facebook",
            lastMessageAt: new Date(),
            status: "open",
          }).returning();
          convId = newConv.id;
        }

        const msgExists = await db.query.messages.findFirst({
          where: eq(messages.platformMessageId, mid),
        });
        if (msgExists) continue;

        await db.insert(messages).values({
          conversationId: convId,
          platformMessageId: mid,
          content: text,
          senderName,
          direction: "inbound",
          createdAt: new Date(),
        });

        const hasReplies = await db.query.messages.findFirst({
          where: and(eq(messages.conversationId, convId), eq(messages.direction, "outbound")),
        });
        if (!hasReplies) {
          const inventory = await db.query.products.findMany({
            where: eq(products.tenantId, conn.tenantId),
          });
          const reply = await generateAutoReply(
            text,
            senderName,
            inventory.map((p) => ({
              name: p.name,
              description: p.description,
              price: p.price,
              stockStatus: p.stockStatus,
              images: p.images,
            })),
            businessName
          );
          if (reply && page.accessToken) {
            await fetch(
              `https://graph.facebook.com/v21.0/me/messages?access_token=${page.accessToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: psid },
                  message: { text: reply },
                  messaging_type: "RESPONSE",
                }),
              }
            );
            await db.insert(messages).values({
              conversationId: convId,
              content: reply,
              senderName: "AI Assistant",
              direction: "outbound",
            });
            await db.update(conversations)
              .set({ lastMessagePreview: reply.slice(0, 100), lastMessageAt: new Date() })
              .where(eq(conversations.id, convId));
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
