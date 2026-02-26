import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetAthleteSummaryTable } from "@/components/meets/meet-athlete-summary-table";
import { sortEventsByOrder } from "@/lib/event-utils";
import {
  getComputedMeetView,
  hasRealResults,
  hasSimulatedData,
  type ViewMode,
} from "@/lib/meet-simulate-compute";

export const dynamic = "force-dynamic";

function parseViewParam(param: string | null): ViewMode {
  if (param === "simulated" || param === "real" || param === "hybrid") return param;
  return "simulated";
}

export default async function ViewMeetAthletesPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { shareToken } = await params;
  const { view: viewParam } = await searchParams;
  const view = parseViewParam(viewParam ?? null);

  const meet = await prisma.meet.findUnique({
    where: { shareToken },
    include: {
      meetTeams: {
        include: {
          team: { select: { id: true, name: true, schoolName: true, primaryColor: true } },
        },
      },
      meetLineups: {
        include: {
          athlete: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  schoolName: true,
                  primaryColor: true,
                },
              },
            },
          },
          event: true,
        },
      },
      relayEntries: {
        include: {
          team: {
            select: { id: true, name: true, primaryColor: true },
          },
          event: true,
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  const realResultsEventIds = meet.realResultsEventIds
    ? (JSON.parse(meet.realResultsEventIds) as string[])
    : [];
  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};
  const meetForCompute = { ...meet, individualScoring, relayScoring };

  const { meetLineups, relayEntries, meetTeams } = getComputedMeetView(
    meetForCompute,
    view,
    realResultsEventIds
  );

  const hasDataForView =
    view === "real"
      ? hasRealResults(meet, realResultsEventIds)
      : hasSimulatedData(meet);

  const lineupAthleteIds = new Set(meetLineups.map((l) => l.athleteId));
  const relayMemberIds = new Set<string>();
  relayEntries.forEach((entry) => {
    const e = entry as { members?: string | null };
    if (!e.members) return;
    try {
      const ids = JSON.parse(e.members) as (string | null)[];
      ids.forEach((id) => {
        if (id && typeof id === "string") relayMemberIds.add(id);
      });
    } catch (_) {}
  });
  const relayOnlyIds = [...relayMemberIds].filter((aid) => !lineupAthleteIds.has(aid));
  const relayOnlyAthletes =
    relayOnlyIds.length > 0
      ? await prisma.athlete.findMany({
          where: { id: { in: relayOnlyIds } },
          include: {
            team: {
              select: { id: true, name: true, schoolName: true, primaryColor: true },
            },
          },
        })
      : [];

  if (!hasDataForView) {
    const emptyMessage =
      view === "real"
        ? "No real results entered yet."
        : view === "simulated"
          ? "No seed times or entries to simulate."
          : "No data for hybrid view.";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Athlete Summary</h2>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600">{emptyMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEventIds = meet.selectedEvents ? (JSON.parse(meet.selectedEvents) as string[]) : [];
  const eventOrder = meet.eventOrder ? (JSON.parse(meet.eventOrder) as string[]) : null;
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEventIds } },
  });
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const testSpotAthleteIds: string[] = [];
  meetTeams?.forEach((mt) => {
    if (mt.testSpotAthleteIds) {
      try {
        testSpotAthleteIds.push(...(JSON.parse(mt.testSpotAthleteIds) as string[]));
      } catch (_) {}
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Athlete Summary</h2>
        <p className="text-slate-600 mt-1">{meet.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Athlete Summary</CardTitle>
          <CardDescription>
            Overview of all athletes competing in this meet, including events and projected points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetAthleteSummaryTable
            meetLineups={meetLineups}
            relayEntries={relayEntries}
            relayOnlyAthletes={relayOnlyAthletes}
            events={events}
            individualScoring={individualScoring}
            relayScoring={relayScoring}
            scoringPlaces={meet.scoringPlaces}
            testSpotAthleteIds={testSpotAthleteIds}
            meetTeams={meetTeams.map((mt) => ({
              teamId: mt.teamId,
              sensitivityVariantAthleteId: (mt as { sensitivityVariantAthleteId?: string | null }).sensitivityVariantAthleteId,
              sensitivityVariant: (mt as { sensitivityVariant?: string | null }).sensitivityVariant,
              sensitivityPercent: (mt as { sensitivityPercent?: number | null }).sensitivityPercent,
              team: mt.team,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
