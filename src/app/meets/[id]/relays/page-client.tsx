"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RelayCreator } from "@/components/meets/relay-creator";
import { RelayNavigation } from "@/components/meets/relay-navigation";
import { formatTeamName } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  athletes: any[];
}

interface MeetTeam {
  id: string;
  teamId: string;
  team: Team;
}

interface RelayEvent {
  id: string;
  name: string;
  legs: string[];
  distances: string[];
}

interface MeetRelaysPageClientProps {
  meetId: string;
  meetTeams: MeetTeam[];
  relayEvents: RelayEvent[];
  maxRelays: number;
  meetName: string;
}

export function MeetRelaysPageClient({
  meetId,
  meetTeams,
  relayEvents,
  maxRelays,
  meetName,
}: MeetRelaysPageClientProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  // Filter teams based on selection
  const filteredTeams = selectedTeamId === "all"
    ? meetTeams
    : meetTeams.filter((mt) => mt.teamId === selectedTeamId);

  // Get unique team names for the filter dropdown
  const teamOptions = meetTeams.map((mt) => ({
    id: mt.teamId,
    name: formatTeamName(mt.team.name, mt.team.schoolName),
  }));

  return (
    <div className="space-y-6">
      {/* Team Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter by Team</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="team-filter" className="text-sm font-medium text-slate-700 mb-2 block">
              Select Team
            </Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="team-filter">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teamOptions.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Relay Creators for Each Team */}
      <div className="space-y-6">
        {filteredTeams.map((meetTeam) => (
          <RelayCreator
            key={meetTeam.id}
            meetId={meetId}
            meetTeam={meetTeam}
            team={meetTeam.team}
            relayEvents={relayEvents}
            maxRelays={maxRelays}
          />
        ))}
      </div>

      {/* Navigation */}
      <RelayNavigation
        meetId={meetId}
        teamIds={meetTeams.map((mt) => mt.teamId)}
        backUrl={`/meets/${meetId}/lineups`}
        nextUrl={`/meets/${meetId}`}
      />
    </div>
  );
}
