"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RealResultsUploadProps {
  meetId: string;
}

export function RealResultsUpload({ meetId }: RealResultsUploadProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("addUnknownAthletes", "true");
      const res = await fetch(`/api/meets/${meetId}/results/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      const eventsApplied = data.eventsApplied ?? 0;
      const totalUnresolved = data.totalUnresolved ?? 0;
      setSummary(
        `Applied ${eventsApplied} event(s).` +
          (totalUnresolved > 0 ? ` ${totalUnresolved} unresolved row(s) — reconcile on each event page.` : "")
      );
      toast.success(eventsApplied ? `Applied ${eventsApplied} event(s)` : "Upload complete");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Real results</CardTitle>
        <CardDescription>
          Paste or upload official results per event on each event page. Or upload a full results file here to apply multiple events at once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleUpload}
            disabled={loading}
          />
          <Button variant="outline" asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Uploading..." : "Upload results file (.txt)"}
            </span>
          </Button>
        </label>
        {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </CardContent>
    </Card>
  );
}
