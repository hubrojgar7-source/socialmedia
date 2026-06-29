import { db } from "@/db";
import { users, tenants, tenantMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name || email.split("@")[0],
        email,
        emailVerified: new Date(),
        hashedPassword,
      })
      .returning();

    const slug = (name || email.split("@")[0]).toLowerCase().replace(/\s+/g, "-") + "-" + crypto.randomUUID().slice(0, 8);

    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: name || email.split("@")[0] + "'s Shop",
        slug,
      })
      .returning();

    await db.insert(tenantMembers).values({
      tenantId: newTenant.id,
      userId: newUser.id,
      role: "owner",
    });

    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
