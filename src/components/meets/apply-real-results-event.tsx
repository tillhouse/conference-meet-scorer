"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
interface UnresolvedRow {
  place: number;
  name?: string;
  school?: string;
  schoolCode?: string;
  timeStr?: string;
  score?: string;
  reason: "no_team" | "no_athlete_match" | "multiple_candidates";
  candidateAthleteIds?: string[];
}

interface ApplyRealResultsEventProps {
  meetId: string;
  eventId: string;
  eventName: string;
  eventType: string;
}

export function ApplyRealResultsEvent({
  meetId,
  eventId,
  eventName,
  eventType,
}: ApplyRealResultsEventProps) {
  const router = useRouter();
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    appliedLineups: number;
    appliedRelays: number;
    addedAthletes: number;
    unresolved: UnresolvedRow[];
    parseErrors: string[];
  } | null>(null);

  const handleApply = async () => {
    if (!resultText.trim()) {
      toast.error("Paste result text first");
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/meets/${meetId}/events/${eventId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultText: resultText.trim(),
          eventType: eventType === "relay" ? "relay" : eventType === "diving" ? "diving" : "individual",
          addUnknownAthletes: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply results");
      }
      setLastResult({
        appliedLineups: data.appliedLineups ?? 0,
        appliedRelays: data.appliedRelays ?? 0,
        addedAthletes: data.addedAthletes ?? 0,
        unresolved: data.unresolved ?? [],
        parseErrors: data.parseErrors ?? [],
      });
      const msg = [
        data.appliedLineups > 0 && `${data.appliedLineups} lineups`,
        data.appliedRelays > 0 && `${data.appliedRelays} relays`,
        data.addedAthletes > 0 && `${data.addedAthletes} added to roster`,
      ]
        .filter(Boolean)
        .join(", ");
      toast.success(msg ? `Applied: ${msg}` : "Applied.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply results");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Real results</CardTitle>
        <CardDescription>
          Paste official result text for this event. Results will be matched to teams and rosters; unknown athletes can be added.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Paste event results here (e.g. from Meet Manager export)..."
          value={resultText}
          onChange={(e) => setResultText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
        <Button onClick={handleApply} disabled={loading}>
          <Upload className="h-4 w-4 mr-2" />
          {loading ? "Applying..." : "Apply results"}
        </Button>
        {lastResult && (
          <div className="space-y-2 text-sm">
            {(lastResult.appliedLineups > 0 || lastResult.appliedRelays > 0 || lastResult.addedAthletes > 0) && (
              <p className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Applied {lastResult.appliedLineups} lineups, {lastResult.appliedRelays} relays
                {lastResult.addedAthletes > 0 && `; ${lastResult.addedAthletes} added to roster`}.
              </p>
            )}
            {lastResult.unresolved.length > 0 && (
              <div className="flex items-start gap-2 text-amber-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Unresolved: {lastResult.unresolved.length} row(s)</p>
                  <p className="text-xs mt-1">
                    Use &quot;Reconcile&quot; below to connect to an athlete or add as new.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-xs">
                    {lastResult.unresolved.slice(0, 5).map((u, i) => (
                      <li key={i}>
                        Place {u.place}
                        {u.name && `: ${u.name}`}
                        {u.reason === "no_team" && " (school not in meet)"}
                        {u.reason === "multiple_candidates" && " (multiple athletes match)"}
                        {u.reason === "no_athlete_match" && " (no matching athlete)"}
                      </li>
                    ))}
                    {lastResult.unresolved.length > 5 && (
                      <li>… and {lastResult.unresolved.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
            {lastResult.parseErrors.length > 0 && (
              <p className="text-amber-700 text-xs">
                Parse notes: {lastResult.parseErrors.join("; ")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
