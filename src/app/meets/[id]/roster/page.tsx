import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { RosterSelector } from "@/components/meets/roster-selector";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";

export default async function MeetRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetTeams: {
        include: {
          team: {
            include: {
              athletes: {
                where: {
                  isEnabled: true,
                },
                include: {
                  eventTimes: {
                    where: {
                      isRelaySplit: false,
                    },
                    include: {
                      event: true,
                    },
                  },
                },
                orderBy: [
                  { lastName: "asc" },
                  { firstName: "asc" },
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  // Calculate roster constraints
  const maxAthletes = meet.maxAthletes;
  const diverRatio = meet.diverRatio;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Set Team Rosters</h1>
            <p className="text-slate-600 mt-1">
              Select athletes for each team participating in {meet.name}
            </p>
          </div>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Constraints Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Roster Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span>
              <strong>Max Athletes:</strong> {maxAthletes} per team
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <strong>Diver Ratio:</strong> Divers count as {diverRatio} of a swimmer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <strong>Diving Included:</strong> {meet.divingIncluded ? "Yes" : "No"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Example: With 18 max athletes and 0.333 diver ratio, a team could have 17 swimmers + 3 divers (17 + 3×0.333 = 18).
          </p>
        </CardContent>
      </Card>

      {/* Team Rosters */}
      <div className="space-y-6">
        {meet.meetTeams.map((meetTeam) => (
          <RosterSelector
            key={meetTeam.id}
            meetId={id}
            meetTeam={meetTeam}
            team={meetTeam.team}
            maxAthletes={maxAthletes}
            diverRatio={diverRatio}
            divingIncluded={meet.divingIncluded}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" asChild>
          <Link href={`/meets/${id}`}>Cancel</Link>
        </Button>
        <Button asChild>
          <Link href={`/meets/${id}/lineups`}>
            Next: Set Event Lineups
          </Link>
        </Button>
      </div>
    </div>
  );
}
