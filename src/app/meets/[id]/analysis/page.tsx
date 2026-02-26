import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";
import { SensitivityAthleteTable } from "@/components/meets/sensitivity-athlete-table";
import { formatName, formatTeamName, normalizeTimeFormat, parseTimeToSeconds } from "@/lib/utils";

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
    const raw = (mt as { sensitivityAthleteIds?: string | null }).sensitivityAthleteIds;
    const resultsRaw = (mt as { sensitivityResults?: string | null }).sensitivityResults;
    if (!raw) return false;
    try {
      const ids = JSON.parse(raw) as string[];
      if (ids.length === 0) return false;
      const results = resultsRaw ? (JSON.parse(resultsRaw) as { athleteId: string }[]) : [];
      return results.length > 0;
    } catch {
      return false;
    }
  });

  const hasAnyAnalysis = teamsWithTestSpot.length > 0 || teamsWithSensitivity.length > 0;

  type EventRow = { eventName: string; eventType: string; timeSec: number | null; points: number };
  function getLineupTimeSec(l: {
    overrideTimeSeconds?: number | null;
    seedTimeSeconds?: number | null;
    overrideTime?: string | null;
    seedTime?: string | null;
  }): number | null {
    const sec = l.overrideTimeSeconds ?? l.seedTimeSeconds;
    if (sec != null) return sec;
    const str = l.overrideTime ?? l.seedTime;
    return str != null && str !== "" ? parseTimeToSeconds(str) : null;
  }
  function buildEventBreakdown(
    lineups: typeof meet.meetLineups,
    athleteId: string,
    teamId: string,
    sensPct: number
  ): { better: EventRow[]; baseline: EventRow[]; worse: EventRow[] } {
    const athleteLineups = lineups.filter(
      (l) => l.athleteId === athleteId && l.athlete?.teamId === teamId
    );
    const pct = sensPct / 100;
    const better: EventRow[] = [];
    const baseline: EventRow[] = [];
    const worse: EventRow[] = [];
    for (const lineup of athleteLineups) {
      const eventName = lineup.event?.name ?? "";
      const eventType = lineup.event?.eventType ?? "individual";
      const baseTime = getLineupTimeSec(lineup) ?? 0;
      const isDiving = eventType === "diving";
      better.push({
        eventName,
        eventType,
        timeSec: isDiving ? baseTime * (1 + pct) : baseTime * (1 - pct),
        points: (lineup as { sensitivityPointsBetter?: number | null }).sensitivityPointsBetter ?? 0,
      });
      baseline.push({
        eventName,
        eventType,
        timeSec: baseTime || null,
        points: lineup.points ?? 0,
      });
      worse.push({
        eventName,
        eventType,
        timeSec: isDiving ? baseTime * (1 - pct) : baseTime * (1 + pct),
        points: (lineup as { sensitivityPointsWorse?: number | null }).sensitivityPointsWorse ?? 0,
      });
    }
    return { better, baseline, worse };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analysis Results</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      <MeetNavigation meetId={id} status={meet.status} scoringMode={meet.scoringMode} />

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
        <div className="space-y-6 w-full">
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
                    const currentTeamTotal = (mt as { totalScore?: number }).totalScore ?? 0;
                    const scoringPts = pointsByAthleteId.get(scoringId) ?? 0;
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
                          const teamTotalWhenScoring = currentTeamTotal - scoringPts + subtotal;
                          const isScoring = aid === scoringId;
                          return (
                            <div key={aid} className="mt-4">
                              <div className={`text-sm font-medium ${isScoring ? "text-slate-900" : "text-slate-700"}`}>
                                {name}
                              </div>
                              <div className="mt-1 overflow-x-auto">
                                <table className="w-full text-sm border-collapse analysis-table">
                                  <colgroup>
                                    <col className="min-w-[8rem]" />
                                    <col className="w-[7rem]" />
                                    <col className="w-[6rem]" />
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b bg-slate-50 font-medium text-slate-700">
                                      <th className="text-left py-1.5 pr-3">Event</th>
                                      <th className="text-right py-1.5 pr-3 w-[7rem]">Time</th>
                                      <th className="text-right py-1.5 font-medium w-[6rem]">Points</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lineups.map((l) => {
                                      const timeStr = (l as { overrideTime?: string | null }).overrideTime ?? l.seedTime;
                                      const pts = l.points ?? 0;
                                      return (
                                        <tr key={l.id} className="border-b border-slate-100">
                                          <td className="py-1.5 pr-3">{l.event.name}</td>
                                          <td className="text-right py-1.5 pr-3 font-mono tabular-nums w-[7rem]">
                                            {timeStr ? normalizeTimeFormat(timeStr) : "—"}
                                          </td>
                                          <td className="text-right py-1.5 font-medium text-green-600 w-[6rem]">
                                            {pts > 0 ? pts.toFixed(1) : "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="border-t font-medium text-slate-900">
                                      <td className="py-2 pr-3">Subtotal</td>
                                      <td className="text-right py-2 pr-3 w-[7rem]" />
                                      <td className="text-right py-2 w-[6rem]">{subtotal.toFixed(1)}</td>
                                    </tr>
                                    <tr className="border-t-2 border-slate-200 font-medium text-slate-900">
                                      <td className="py-2 pr-3">Team Total</td>
                                      <td className="text-right py-2 pr-3 w-[7rem]" />
                                      <td className="text-right py-2 w-[6rem]">{teamTotalWhenScoring.toFixed(1)}</td>
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
                    Team and athlete impact when selected athletes perform X% better or worse
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {teamsWithSensitivity.map((mt) => {
                    const sensPct = (mt as { sensitivityPercent?: number | null }).sensitivityPercent ?? 1;
                    const baseline = (mt as { totalScore: number }).totalScore;
                    const teamName = formatTeamName(mt.team.name, mt.team.schoolName);
                    const resultsRaw = (mt as { sensitivityResults?: string | null }).sensitivityResults;
                    type SensResult = {
                      athleteId: string;
                      teamTotalBetter: number;
                      teamTotalWorse: number;
                      athletePtsBaseline: number;
                      athletePtsBetter: number;
                      athletePtsWorse: number;
                      timeBaselineSec?: number | null;
                      timeBetterSec?: number | null;
                      timeWorseSec?: number | null;
                      isRepresentativeDiving?: boolean;
                    };
                    const results: SensResult[] = resultsRaw ? (JSON.parse(resultsRaw) as SensResult[]) : [];
                    return (
                      <div
                        key={mt.id}
                        className="rounded-lg border p-4"
                        style={mt.team.primaryColor ? { borderLeftWidth: 4, borderLeftColor: mt.team.primaryColor } : undefined}
                      >
                        <div className="font-semibold text-slate-900">{teamName}</div>
                        <div className="mt-1 text-sm text-slate-600">±{sensPct}%</div>
                        {results.map((r) => {
                          const athleteName = athleteIdToName.get(r.athleteId) ?? r.athleteId;
                          const eventBreakdown = buildEventBreakdown(
                            meet.meetLineups,
                            r.athleteId,
                            mt.team.id,
                            sensPct
                          );
                          return (
                            <div
                              key={r.athleteId}
                              className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                            >
                              <div className="text-sm font-medium text-slate-900">{athleteName}</div>
                              <div className="mt-1">
                                <SensitivityAthleteTable
                                  athleteName={athleteName}
                                  sensPct={sensPct}
                                  baseline={baseline}
                                  result={r}
                                  eventBreakdown={eventBreakdown}
                                />
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
        </div>
      )}
    </div>
  );
}
