"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DebugInfoProps {
  meetId: string;
  meetLineupsCount: number;
  relayEntriesCount: number;
  selectedEventsCount: number;
  eventsFoundCount: number;
}

export function DebugInfo({
  meetId,
  meetLineupsCount,
  relayEntriesCount,
  selectedEventsCount,
  eventsFoundCount,
}: DebugInfoProps) {
  const handleFetchDebug = async () => {
    const response = await fetch(`/api/meets/${meetId}/debug`);
    const data = await response.json();
    console.log("Full debug data:", data);
    alert(
      `Check console (F12) for full debug data.\n\nLineups: ${data.meetLineupsCount}\nRelays: ${data.relayEntriesCount}`
    );
  };

  return (
    <Card className="bg-yellow-50 border-yellow-200">
      <CardHeader>
        <CardTitle className="text-sm">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p>MeetLineups: {meetLineupsCount}</p>
        <p>RelayEntries: {relayEntriesCount}</p>
        <p>Selected Events: {selectedEventsCount}</p>
        <p>Events Found: {eventsFoundCount}</p>
        <Button variant="outline" size="sm" onClick={handleFetchDebug}>
          Fetch Full Debug Data
        </Button>
      </CardContent>
    </Card>
  );
}
