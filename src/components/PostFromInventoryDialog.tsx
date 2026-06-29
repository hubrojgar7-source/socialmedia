"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  price: string | null;
  images: string[];
}

interface PlatformConnection {
  id: string;
  platformUserName: string;
  metadata: {
    pages?: { id: string; name: string }[];
    groups?: { id: string; name: string }[];
  };
}

interface PostFromInventoryDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PostFromInventoryDialog({
  product,
  open,
  onOpenChange,
}: PostFromInventoryDialogProps) {
  const router = useRouter();
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [title, setTitle] = useState(product.title || product.name);
  const [description, setDescription] = useState(product.description || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/connections")
        .then((r) => r.json())
        .then(setConnections);
    }
  }, [open]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handlePost() {
    if (selected.length === 0) {
      toast.error("Select at least one destination");
      return;
    }
    setPosting(true);

    const destinations = selected.map((key) => {
      const [connectionId, destinationType, destinationId, ...rest] = key.split("|");
      return {
        connectionId,
        destinationType,
        destinationId,
        destinationName: rest.join("|"),
      };
    });

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        imageUrl: product.images[0],
        destinations,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to create post");
      setPosting(false);
      return;
    }

    const post = await res.json();
    await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });

    toast.success("Posted successfully!");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Post: {product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {product.price && (
            <p className="text-sm text-muted-foreground">
              Price: {product.price}
            </p>
          )}

          <div className="space-y-2">
            <Label>Post To</Label>
            {connections.map((conn) => (
              <div key={conn.id} className="space-y-1 pl-2">
                <p className="text-sm font-medium">{conn.platformUserName}</p>
                {conn.metadata?.pages?.map((page) => (
                  <label key={page.id} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={selected.includes(`${conn.id}|page|${page.id}|${page.name}`)}
                      onCheckedChange={() => toggle(`${conn.id}|page|${page.id}|${page.name}`)}
                    />
                    Page: {page.name}
                  </label>
                ))}
                {conn.metadata?.pages?.map((page) => (
                  <label key={`mp-${page.id}`} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={selected.includes(`${conn.id}|marketplace|${page.id}|${page.name} (Marketplace)`)}
                      onCheckedChange={() => toggle(`${conn.id}|marketplace|${page.id}|${page.name} (Marketplace)`)}
                    />
                    Marketplace: {page.name}
                  </label>
                ))}
                {conn.metadata?.groups?.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 pl-4 text-sm">
                    <Checkbox
                      checked={selected.includes(`${conn.id}|group|${group.id}|${group.name}`)}
                      onCheckedChange={() => toggle(`${conn.id}|group|${group.id}|${group.name}`)}
                    />
                    Group: {group.name}
                  </label>
                ))}
              </div>
            ))}
            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No platforms connected.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePost} disabled={posting}>
            {posting ? "Posting..." : "Post Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
