"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, MessageCircle, MessageSquare, ThumbsUp } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  platform: string;
  profilePictureUrl: string | null;
  interactionType: string;
  lastInteractionAt: string | null;
  platformUserId: string;
}

const platformColors: Record<string, string> = {
  facebook: "bg-blue-100 text-blue-800",
  messenger: "bg-sky-100 text-sky-800",
  instagram: "bg-pink-100 text-pink-800",
};

const typeIcons: Record<string, React.ReactNode> = {
  dm: <MessageCircle className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  like: <ThumbsUp className="h-4 w-4" />,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    const res = await fetch("/api/customers");
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    await fetch("/api/customers", { method: "POST" });
    await fetchCustomers();
    setSyncing(false);
  };

  useEffect(() => { fetchCustomers() }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Button onClick={syncNow} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from Facebook"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : customers.length === 0 ? (
            <p className="text-muted-foreground">
              No customers yet. Click "Sync from Facebook" to import customers who have interacted with your page.
            </p>
          ) : (
            <div className="space-y-3">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <img
                    src={c.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`}
                    alt={c.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.lastInteractionAt
                        ? new Date(c.lastInteractionAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                          })
                        : "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={platformColors[c.platform] || ""}>
                      {c.platform}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {typeIcons[c.interactionType] || null}
                      {c.interactionType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
