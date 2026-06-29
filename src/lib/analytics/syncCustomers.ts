import { db } from "@/db";
import { platformConnections, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function syncFacebookCustomers(tenantId: string, connectionId: string): Promise<{ added: number; updated: number }> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(eq(platformConnections.id, connectionId), eq(platformConnections.tenantId, tenantId)),
  });
  if (!connection?.accessToken) return { added: 0, updated: 0 };

  const token = connection.accessToken;
  const pages = (connection.metadata as any)?.pages || [];
  let added = 0;
  let updated = 0;

  for (const page of pages) {
    const pageToken = page.accessToken || token;
    const fbCustomers = new Map<string, { name: string; picture: string; type: string }>();

    // 1. Conversation participants (DMs)
    try {
      const convRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/conversations?fields=participants,updated_time&limit=100&access_token=${pageToken}`
      );
      const convData = await convRes.json();
      if (convData.error) {
        console.warn("FB API conv error:", convData.error.message);
      } else if (convData.data) {
        for (const conv of convData.data) {
          for (const p of conv.participants?.data || []) {
            if (p.id !== page.id) {
              const existing = fbCustomers.get(p.id);
              if (!existing || new Date(conv.updated_time) > new Date()) {
                fbCustomers.set(p.id, {
                  name: p.name || "Unknown",
                  picture: `https://graph.facebook.com/v21.0/${p.id}/picture?type=large&access_token=${pageToken}`,
                  type: "dm",
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to sync conversations for page", page.id, e);
    }

    // 2. Post commenters (using /posts instead of /feed, higher limit)
    try {
      const feedRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/posts?fields=comments.limit(100){from,name,message,created_time},created_time&limit=25&access_token=${pageToken}`
      );
      const feedData = await feedRes.json();
      if (feedData.error) {
        console.warn("FB API posts error:", feedData.error.message);
      } else if (feedData.data) {
        for (const post of feedData.data) {
          for (const c of post.comments?.data || []) {
            if (c.from?.id && c.from.id !== page.id) {
              fbCustomers.set(c.from.id, {
                name: c.from.name || "Unknown",
                picture: `https://graph.facebook.com/v21.0/${c.from.id}/picture?type=large&access_token=${pageToken}`,
                type: "comment",
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to sync comments for page", page.id, e);
    }

    // Save to DB
    for (const [platformUserId, info] of fbCustomers) {
      const existing = await db.query.customers.findFirst({
        where: and(
          eq(customers.tenantId, tenantId),
          eq(customers.platform, "facebook"),
          eq(customers.platformUserId, platformUserId)
        ),
      });

      if (existing) {
        await db.update(customers)
          .set({
            name: info.name,
            profilePictureUrl: info.picture,
            interactionType: existing.interactionType === "dm" ? "dm" : info.type as any,
            lastInteractionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existing.id));
        updated++;
      } else {
        await db.insert(customers).values({
          tenantId,
          platform: "facebook",
          platformUserId,
          name: info.name,
          profilePictureUrl: info.picture,
          interactionType: info.type as any,
          lastInteractionAt: new Date(),
        });
        added++;
      }
    }
  }

  return { added, updated };
}
