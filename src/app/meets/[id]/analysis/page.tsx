import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";
import { formatName, formatTeamName, normalizeTimeFormat } from "@/lib/utils";

export default async function MeetAnalysisPage({
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
            select: {
              id: true,
              name: true,
              schoolName: true,
              primaryColor: true,
            },
          },
        },
      },
      meetLineups: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              teamId: true,
            },
          },
          event: {
            select: { id: true, name: true, eventType: true },
          },
        },
      },
      relayEntries: { select: { place: true } },
    },
  });

  if (!meet) {
    notFound();
  }

  const hasResults =
    meet.meetLineups.some((l) => l.place !== null) || meet.relayEntries.some((r) => r.place !== null);

  const athleteIdToName = new Map<string, string>();
  const pointsByAthleteId = new Map<string, number>();
  meet.meetLineups.forEach((l) => {
    const a = l.athlete;
    if (a?.id && (a.firstName != null || a.lastName != null)) {
      athleteIdToName.set(a.id, formatName(a.firstName ?? "", a.lastName ?? ""));
    }
    const current = pointsByAthleteId.get(l.athleteId) ?? 0;
    pointsByAthleteId.set(l.athleteId, current + (l.points ?? 0));
  });

  const teamsWithTestSpot = meet.meetTeams.filter((mt) => {
    const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
    if (!raw) return false;
    try {
      const arr = JSON.parse(raw) as string[];
      return arr.length > 0;
    } catch {
      return false;
    }
  });

  const teamsWithSensitivity = meet.meetTeams.filter((mt) => {
    const sensId = (mt as { sensitivityAthleteId?: string | null }).sensitivityAthleteId;
    const better = (mt as { sensitivityTotalScoreBetter?: number | null }).sensitivityTotalScoreBetter;
    const worse = (mt as { sensitivityTotalScoreWorse?: number | null }).sensitivityTotalScoreWorse;
    return !!sensId && (better != null || worse != null);
  });

  const hasAnyAnalysis = teamsWithTestSpot.length > 0 || teamsWithSensitivity.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analysis Results</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      <MeetNavigation meetId={id} status={meet.status} />

      {!hasResults ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600">
              Run Simulate to see analysis results. After simulating, test spot and sensitivity outputs will appear here.
            </p>
          </CardContent>
        </Card>
      ) : !hasAnyAnalysis ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600">
              No analysis configured. Set a test spot or sensitivity athlete on Set Rosters, then run Simulate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {teamsWithTestSpot.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Spot</CardTitle>
                <CardDescription>
                  Compare projected points for athletes competing for the test spot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamsWithTestSpot.map((mt) => {
                  const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
                  let testSpotIds: string[] = [];
                  try {
                    testSpotIds = raw ? (JSON.parse(raw) as string[]) : [];
                  } catch {}
                  const scoringId = (mt as { testSpotScoringAthleteId?: string | null }).testSpotScoringAthleteId ?? testSpotIds[0];
                  const teamName = formatTeamName(mt.team.name, mt.team.schoolName);
                  const teamId = mt.team.id;
                  const sorted = [...testSpotIds].sort(
                    (a, b) => (pointsByAthleteId.get(b) ?? 0) - (pointsByAthleteId.get(a) ?? 0)
                  );
                  return (
                    <div
                      key={mt.id}
                      className="rounded-lg border p-4"
                      style={mt.team.primaryColor ? { borderLeftWidth: 4, borderLeftColor: mt.team.primaryColor } : undefined}
                    >
                      <div className="font-semibold text-slate-900">{teamName}</div>
                      <div className="mt-2 text-sm text-slate-600">
                        Scoring athlete: {scoringId ? athleteIdToName.get(scoringId) ?? scoringId : "—"}
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-slate-600">Projected pts: </span>
                        {sorted.map((aid) => {
                          const name = athleteIdToName.get(aid) ?? aid;
                          const pts = pointsByAthleteId.get(aid) ?? 0;
                          const isScoring = aid === scoringId;
                          return (
                            <span key={aid} className={isScoring ? "font-medium text-slate-900" : "text-slate-600"}>
                              {name} {pts.toFixed(1)}
                              {sorted.indexOf(aid) < sorted.length - 1 ? ", " : ""}
                            </span>
                          );
                        })}
                      </div>
                      {sorted.map((aid) => {
                        const lineups = meet.meetLineups.filter(
                          (l) => l.athleteId === aid && l.athlete.teamId === teamId
                        );
                        const name = athleteIdToName.get(aid) ?? aid;
                        const subtotal = pointsByAthleteId.get(aid) ?? 0;
                        const isScoring = aid === scoringId;
                        return (
                          <div key={aid} className="mt-4">
                            <div className={`text-sm font-medium ${isScoring ? "text-slate-900" : "text-slate-700"}`}>
                              {name}
                            </div>
                            <div className="mt-1 overflow-x-auto">
                              <table className="w-full min-w-[280px] text-sm border-collapse">
                                <thead>
                                  <tr className="border-b text-slate-600">
                                    <th className="text-left py-1.5 pr-3 font-medium">Event</th>
                                    <th className="text-right py-1.5 pr-3 font-medium">Time</th>
                                    <th className="text-right py-1.5 font-medium">Points</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lineups.map((l) => {
                                    const timeStr = (l as { overrideTime?: string | null }).overrideTime ?? l.seedTime;
                                    const pts = l.points ?? 0;
                                    return (
                                      <tr key={l.id} className="border-b border-slate-100">
                                        <td className="py-1.5 pr-3">{l.event.name}</td>
                                        <td className="text-right py-1.5 pr-3 font-mono tabular-nums">
                                          {timeStr ? normalizeTimeFormat(timeStr) : "—"}
                                        </td>
                                        <td className="text-right py-1.5 font-medium text-green-600">
                                          {pts > 0 ? pts.toFixed(1) : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="border-t font-medium text-slate-900">
                                    <td className="py-2 pr-3">Subtotal</td>
                                    <td className="text-right py-2 pr-3" />
                                    <td className="text-right py-2">{subtotal.toFixed(1)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {teamsWithSensitivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sensitivity Analysis</CardTitle>
                <CardDescription>
                  Team and athlete impact when the selected athlete performs X% better or worse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamsWithSensitivity.map((mt) => {
                  const sensId = (mt as { sensitivityAthleteId?: string | null }).sensitivityAthleteId;
                  const sensPct = (mt as { sensitivityPercent?: number | null }).sensitivityPercent ?? 1;
                  const baseline = (mt as { totalScore: number }).totalScore;
                  const better = (mt as { sensitivityTotalScoreBetter?: number | null }).sensitivityTotalScoreBetter;
                  const worse = (mt as { sensitivityTotalScoreWorse?: number | null }).sensitivityTotalScoreWorse;
                  const athleteBaseline = (mt as { sensitivityAthletePointsBaseline?: number | null }).sensitivityAthletePointsBaseline;
                  const athleteBetter = (mt as { sensitivityAthletePointsBetter?: number | null }).sensitivityAthletePointsBetter;
                  const athleteWorse = (mt as { sensitivityAthletePointsWorse?: number | null }).sensitivityAthletePointsWorse;
                  const teamName = formatTeamName(mt.team.name, mt.team.schoolName);
                  const athleteName = sensId ? athleteIdToName.get(sensId) ?? sensId : "—";
                  return (
                    <div
                      key={mt.id}
                      className="rounded-lg border p-4"
                      style={mt.team.primaryColor ? { borderLeftWidth: 4, borderLeftColor: mt.team.primaryColor } : undefined}
                    >
                      <div className="font-semibold text-slate-900">{teamName}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {athleteName} · ±{sensPct}%
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b font-medium text-slate-700">
                              <th className="text-left py-2 pr-4">Scenario</th>
                              <th className="text-right py-2 pr-4">Team Total</th>
                              <th className="text-right py-2">Individual Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="py-2 pr-4">Baseline</td>
                              <td className="text-right py-2 pr-4">{baseline.toFixed(1)}</td>
                              <td className="text-right py-2">{athleteBaseline != null ? athleteBaseline.toFixed(1) : "—"}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-2 pr-4">Better ({sensPct}%)</td>
                              <td className="text-right py-2 pr-4">{better != null ? better.toFixed(1) : "—"}</td>
                              <td className="text-right py-2">{athleteBetter != null ? athleteBetter.toFixed(1) : "—"}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-2 pr-4">Worse ({sensPct}%)</td>
                              <td className="text-right py-2 pr-4">{worse != null ? worse.toFixed(1) : "—"}</td>
                              <td className="text-right py-2">{athleteWorse != null ? athleteWorse.toFixed(1) : "—"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
