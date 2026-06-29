"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportCSVPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-bold">Import CSV</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upload Products CSV</CardTitle>
          <CardDescription>
            CSV headers: name, title, description, price, stock_status, sku, image_url
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex h-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 hover:bg-muted"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-sm text-muted-foreground">
              {importing ? "Importing..." : "Click to upload CSV"}
            </p>
          </div>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

          {result && (
            <div className="rounded bg-green-50 p-3 text-sm text-green-700">
              Imported {result.count} products successfully!
            </div>
          )}
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard/inventory")}>
            Back to Inventory
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
