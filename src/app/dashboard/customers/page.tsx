"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, MessageCircle, MessageSquare, ThumbsUp, AlertCircle } from "lucide-react";

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
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  messenger: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
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
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      setError("Failed to load customers");
    }
    setLoading(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setError(data.error);
      } else {
        toast.success(`Synced: ${data.added} new, ${data.updated} updated`);
      }
      await fetchCustomers();
    } catch {
      toast.error("Sync failed");
    }
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

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Customers ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="mb-2">No customers yet.</p>
              <p className="text-sm">Click "Sync from Facebook" to import customers who have messaged or commented on your page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <img
                    src={c.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`}
                    alt={c.name}
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`;
                    }}
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
