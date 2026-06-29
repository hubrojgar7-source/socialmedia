"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PostDestination {
  id: string;
  destinationName: string;
  destinationType: string;
  status: string;
  error: string | null;
}

interface Post {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  destinations: PostDestination[];
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  published: { label: "Published", variant: "default" },
  partial: { label: "Partial", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  publishing: { label: "Publishing", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/posts/history")
      .then((r) => r.json())
      .then(setPosts);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Post History</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Destinations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[post.status]?.variant || "outline"}>
                      {statusBadge[post.status]?.label || post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-sm text-primary underline cursor-pointer"
                      onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                    >
                      {post.destinations?.length || 0} destinations
                    </button>
                    {expanded === post.id && (
                      <div className="mt-2 space-y-1">
                        {post.destinations?.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            <Badge
                              variant={d.status === "published" ? "default" : d.status === "failed" ? "destructive" : "outline"}
                              className="px-1 py-0"
                            >
                              {d.status}
                            </Badge>
                            <span>{d.destinationName}</span>
                            {d.error && <span className="text-destructive">({d.error})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No posts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
