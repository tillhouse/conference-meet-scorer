"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RosterSelector } from "@/components/meets/roster-selector";
import { formatTeamName } from "@/lib/utils";

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  eventTimes: {
    id: string;
    event: { id: string; name: string };
  }[];
};

type Team = {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  athletes: Athlete[];
};

type MeetTeam = {
  id: string;
  teamId: string;
  team: Team;
};

type RosterPageClientProps = {
  meetId: string;
  meetTeams: MeetTeam[];
  maxAthletes: number;
  diverRatio: number;
  divingIncluded: boolean;
};

export function RosterPageClient({
  meetId,
  meetTeams,
  maxAthletes,
  diverRatio,
  divingIncluded,
}: RosterPageClientProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    meetTeams[0]?.teamId ?? ""
  );

  const selectedMeetTeam = meetTeams.find((mt) => mt.teamId === selectedTeamId);

  if (meetTeams.length === 0) {
    return (
      <p className="text-slate-600">No teams are assigned to this meet yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="roster-team-filter" className="text-sm font-medium text-slate-700">
            Filter by team
          </Label>
          <Select
            value={selectedTeamId}
            onValueChange={setSelectedTeamId}
          >
            <SelectTrigger id="roster-team-filter" className="w-[280px]">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {meetTeams.map((meetTeam) => (
                <SelectItem
                  key={meetTeam.id}
                  value={meetTeam.teamId}
                >
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

      {selectedMeetTeam && (
        <RosterSelector
          key={selectedMeetTeam.id}
          meetId={meetId}
          meetTeam={selectedMeetTeam}
          team={selectedMeetTeam.team}
          maxAthletes={maxAthletes}
          diverRatio={diverRatio}
          divingIncluded={divingIncluded}
        />
      )}
    </div>
  );
}
