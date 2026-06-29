import { auth } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.query.products.findMany({
    where: eq(products.tenantId, session.user.tenantId),
    orderBy: desc(products.createdAt),
  });

  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, title, description, price, stockStatus, sku, image } = body;

  const [product] = await db
    .insert(products)
    .values({
      tenantId: session.user.tenantId,
      name,
      title: title || name,
      description,
      price,
      stockStatus: stockStatus || "in_stock",
      sku,
      images: image ? [image] : [],
    })
    .returning();

  return NextResponse.json(product, { status: 201 });
}
