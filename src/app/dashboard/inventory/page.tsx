"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PostFromInventoryDialog from "@/components/PostFromInventoryDialog";

interface Product {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  price: string | null;
  stockStatus: string;
  images: string[];
  createdAt: string;
}

const stockBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_stock: { label: "In Stock", variant: "default" },
  low_stock: { label: "Low Stock", variant: "secondary" },
  sold: { label: "Sold", variant: "destructive" },
  discontinued: { label: "Discontinued", variant: "outline" },
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [postProduct, setPostProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then(setProducts);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="space-x-2">
          <Link href="/dashboard/inventory/new">
            <Button>Add Product</Button>
          </Link>
          <Link href="/dashboard/inventory/import">
            <Button variant="outline">Import CSV</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.price || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={stockBadge[p.stockStatus]?.variant}>
                      {stockBadge[p.stockStatus]?.label || p.stockStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setPostProduct(p)}>
                      Post
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No products yet. Add your first product.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {postProduct && (
        <PostFromInventoryDialog
          product={postProduct}
          open={!!postProduct}
          onOpenChange={(open) => { if (!open) setPostProduct(null); }}
        />
      )}
    </div>
  );
}
