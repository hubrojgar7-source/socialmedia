"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, AlertCircle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DailyRecord {
  id: string;
  date: string;
  newConversations: number;
  messagesReceived: number;
  comments: number;
  likes: number;
  sales: number;
  revenue: number;
}

interface Totals {
  conversations: number;
  messages: number;
  comments: number;
  likes: number;
  sales: number;
  revenue: number;
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const METRICS = [
  { key: "newConversations", label: "New Conversations", color: "#3b82f6" },
  { key: "messagesReceived", label: "Messages", color: "#10b981" },
  { key: "comments", label: "Comments", color: "#f59e0b" },
  { key: "likes", label: "Likes", color: "#ef4444" },
  { key: "sales", label: "Sales", color: "#8b5cf6" },
  { key: "revenue", label: "Revenue ($)", color: "#ec4899" },
];

export default function AnalyticsPage() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(30);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["newConversations", "messagesReceived", "comments"]);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?days=${d}`);
      const data = await res.json();
      setRecords((data.records || []).reverse());
      setTotals(data.totals || null);
    } catch {
      setError("Failed to load analytics");
    }
    setLoading(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setError(data.error);
      } else {
        toast.success(`Synced ${data.successCount} Facebook connection(s)`);
      }
      await fetchAnalytics(days);
    } catch {
      toast.error("Sync failed");
      setError("Sync failed");
    }
    setSyncing(false);
  };

  useEffect(() => { fetchAnalytics(days) }, [days]);

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Button onClick={syncNow} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {totals && (
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">New Conversations</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totals.conversations}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Messages</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totals.messages}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Comments</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totals.comments}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Likes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totals.likes}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Sales</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totals.sales}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">${totals.revenue}</p></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daily Trends</CardTitle>
          <div className="flex items-center gap-2">
            {[7, 14, 30, 90].map((d) => (
              <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <Button
                key={m.key}
                variant={selectedMetrics.includes(m.key) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleMetric(m.key)}
                style={selectedMetrics.includes(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                {m.label}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="mb-2">No analytics data yet.</p>
              <p className="text-sm">Click "Sync Now" to pull today's data from your connected pages. Data updates daily.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Area Chart</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={records}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetrics.map((k, i) => (
                      <Area
                        key={k}
                        type="monotone"
                        dataKey={k}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        fillOpacity={0.1}
                        name={METRICS.find((m) => m.key === k)?.label || k}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Bar Chart</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={records}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetrics.map((k, i) => (
                      <Bar
                        key={k}
                        dataKey={k}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        name={METRICS.find((m) => m.key === k)?.label || k}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
