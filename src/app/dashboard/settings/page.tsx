import { auth } from "@/lib/auth";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const connections = await db.query.platformConnections.findMany({
    where: eq(platformConnections.tenantId, session.user.tenantId),
  });

  const facebookConnected = connections.some((c) => c.platform === "facebook");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Connected Platforms</CardTitle>
          <CardDescription>Connect your social media accounts to start posting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Facebook</p>
              <p className="text-sm text-muted-foreground">
                {facebookConnected
                  ? "Connected — pages and groups detected"
                  : "Post to Facebook Pages, Groups, and Marketplace"}
              </p>
            </div>
            {facebookConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600">Connected</span>
              </div>
            ) : (
              <a href="/api/facebook/connect">
                <Button>Connect Facebook</Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
