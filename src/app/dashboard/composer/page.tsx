"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";

interface PlatformConnection {
  id: string;
  platform: string;
  platformUserName: string;
  metadata: {
    pages?: { id: string; name: string }[];
    groups?: { id: string; name: string }[];
  };
}

interface Destination {
  connectionId: string;
  destinationType: "page" | "group" | "marketplace" | "profile";
  destinationId: string;
  destinationName: string;
}

export default function ComposerPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<Destination[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then(setConnections);
  }, []);

  function toggleDestination(dest: Destination) {
    setSelectedDestinations((prev) => {
      const key = `${dest.connectionId}-${dest.destinationType}-${dest.destinationId}`;
      const exists = prev.some(
        (d) => `${d.connectionId}-${d.destinationType}-${d.destinationId}` === key
      );
      if (exists) return prev.filter((d) => `${d.connectionId}-${d.destinationType}-${d.destinationId}` !== key);
      return [...prev, dest];
    });
  }

  function isSelected(dest: Destination) {
    const key = `${dest.connectionId}-${dest.destinationType}-${dest.destinationId}`;
    return selectedDestinations.some(
      (d) => `${d.connectionId}-${d.destinationType}-${d.destinationId}` === key
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDestinations.length === 0) {
      toast.error("Select at least one destination");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setPosting(true);

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        imageUrl: imageUrl || undefined,
        destinations: selectedDestinations,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to create post");
      setPosting(false);
      return;
    }

    const post = await res.json();
    await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });

    toast.success("Post published!");
    router.push("/dashboard/posts");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Composer</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Post Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <ImageUpload onUpload={setImageUrl} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No platforms connected.{" "}
                <a href="/dashboard/settings" className="text-primary underline">
                  Connect Facebook
                </a>
              </p>
            )}

            {connections.map((conn) => (
              <div key={conn.id} className="space-y-2">
                <p className="font-medium text-sm">{conn.platformUserName}</p>

                {conn.metadata?.pages?.map((page) => (
                  <label key={page.id} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={isSelected({
                        connectionId: conn.id,
                        destinationType: "page",
                        destinationId: page.id,
                        destinationName: page.name,
                      })}
                      onCheckedChange={() =>
                        toggleDestination({
                          connectionId: conn.id,
                          destinationType: "page",
                          destinationId: page.id,
                          destinationName: page.name,
                        })
                      }
                    />
                    Page: {page.name}
                  </label>
                ))}

                {conn.metadata?.pages?.map((page) => (
                  <label key={`mp-${page.id}`} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={isSelected({
                        connectionId: conn.id,
                        destinationType: "marketplace",
                        destinationId: page.id,
                        destinationName: `${page.name} (Marketplace)`,
                      })}
                      onCheckedChange={() =>
                        toggleDestination({
                          connectionId: conn.id,
                          destinationType: "marketplace",
                          destinationId: page.id,
                          destinationName: `${page.name} (Marketplace)`,
                        })
                      }
                    />
                    Marketplace: {page.name}
                  </label>
                ))}

                {conn.metadata?.groups?.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={isSelected({
                        connectionId: conn.id,
                        destinationType: "group",
                        destinationId: group.id,
                        destinationName: group.name,
                      })}
                      onCheckedChange={() =>
                        toggleDestination({
                          connectionId: conn.id,
                          destinationType: "group",
                          destinationId: group.id,
                          destinationName: group.name,
                        })
                      }
                    />
                    Group: {group.name}
                  </label>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={posting}>
          {posting ? "Posting..." : `Post to ${selectedDestinations.length} destination${selectedDestinations.length !== 1 ? "s" : ""}`}
        </Button>
      </form>
    </div>
  );
}
