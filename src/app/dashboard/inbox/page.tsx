"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Conversation {
  id: string;
  platform: string;
  customerName: string | null;
  lastMessagePreview: string | null;
  unreadCount: number | null;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
}

const platformLabel: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

export default function InboxPage() {
  const [convs, setConvs] = useState<Conversation[]>([]);

  const fetchConvs = () => {
    fetch("/api/inbox/conversations")
      .then((r) => r.json())
      .then(setConvs);
  };

  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  useEffect(() => {
    const doSync = async () => {
      try {
        const res = await fetch("/api/inbox/sync", { method: "POST" });
        const data = await res.json();
        if (data.synced) {
          fetchConvs();
        }
        if (data.errors?.length) {
          setSyncErrors(data.errors);
        }
      } catch {
        // silent
      }
    };
    doSync();
    const interval = setInterval(doSync, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Facebook? This will remove all synced conversations.")) return;
    try {
      const res = await fetch("/api/connections/facebook", { method: "DELETE" });
      if (res.ok) {
        toast.success("Facebook disconnected");
        setConvs([]);
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inbox</h1>
        <Button variant="destructive" size="sm" onClick={handleDisconnect}>
          Disconnect Facebook
        </Button>
      </div>

      {syncErrors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-sm text-destructive space-y-1">
          <p className="font-semibold">Sync Errors:</p>
          {syncErrors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {convs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conversations yet. Connect a platform with messaging enabled to
              see messages here.
            </p>
          ) : (
            <div className="divide-y">
              {convs.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/inbox/${c.id}`}
                  className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {platformLabel[c.platform] || c.platform}
                      </Badge>
                      <span className="font-medium truncate">
                        {c.customerName || "Unknown"}
                      </span>
                      {(c.unreadCount ?? 0) > 0 && (
                        <Badge className="ml-auto shrink-0">
                          {c.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {c.lastMessagePreview && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {c.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 ml-4">
                    {c.lastMessageAt
                      ? new Date(c.lastMessageAt).toLocaleDateString()
                      : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
