import { auth } from "@/lib/auth";
import { db } from "@/db";
import { products, posts, platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;

  const [productCount, postCount, connectionCount] = await Promise.all([
    db.$count(products, eq(products.tenantId, tenantId)),
    db.$count(posts, eq(posts.tenantId, tenantId)),
    db.$count(platformConnections, eq(platformConnections.tenantId, tenantId)),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Connected Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{connectionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{productCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Posts Published</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{postCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
