import { auth } from "@/lib/auth";
import { db } from "@/db";
import { products } from "@/db/schema";
import { NextResponse } from "next/server";

function parseCSV(text: string) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    if (values.length === 1 && values[0] === "") continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    results.push(row);
  }

  return results;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Empty or invalid CSV" }, { status: 400 });
    }

    const inserted = await db.insert(products).values(
      rows.map((row) => ({
        tenantId: session.user.tenantId,
        name: row.name || row.title || "Unnamed",
        title: row.title || row.name || "",
        description: row.description || "",
        price: row.price || "",
        stockStatus: (row.stock_status || row.stockstatus || "in_stock") as any,
        sku: row.sku || "",
        images: row.image_url ? [row.image_url] : [],
      }))
    );

    return NextResponse.json({ count: rows.length });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
