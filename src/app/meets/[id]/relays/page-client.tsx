"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RelayCreator } from "@/components/meets/relay-creator";
import { RelayNavigation } from "@/components/meets/relay-navigation";
import { formatTeamName } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor?: string | null;
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

  return (
    <div className="space-y-6">
      {/* Team Filter - matches Set Rosters styling */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="team-filter" className="text-sm font-medium text-slate-700">
            Filter by team
          </Label>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger id="team-filter" className="w-[280px]">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {meetTeams.map((meetTeam) => (
                <SelectItem key={meetTeam.id} value={meetTeam.teamId}>
                  <span className="flex items-center gap-2">
                    {meetTeam.team.primaryColor && (
                      <span
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: meetTeam.team.primaryColor }}
                        aria-hidden
                      />
                    )}
                    {formatTeamName(meetTeam.team.name, meetTeam.team.schoolName)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
