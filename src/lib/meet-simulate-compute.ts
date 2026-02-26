/**
 * In-memory computation of meet results (place, points, team totals) for a given view mode.
 * Used by the public view to show simulated / real / hybrid without persisting.
 */

import { parseTimeToSeconds } from "@/lib/utils";
import { getScoringAthleteIdSet } from "@/lib/meet-scoring";

export type ViewMode = "simulated" | "real" | "hybrid";

type MeetLineupRow = {
  id: string;
  eventId: string;
  athleteId: string;
  place: number | null;
  points: number | null;
  finalTime: string | null;
  finalTimeSeconds: number | null;
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  realResultApplied?: boolean;
  event: { eventType: string };
  athlete?: { teamId?: string };
};

type RelayEntryRow = {
  id: string;
  eventId: string;
  teamId: string;
  place: number | null;
  points: number | null;
  finalTime: string | null;
  finalTimeSeconds: number | null;
  overrideTime: string | null;
  overrideTimeSeconds: number | null;
  seedTime: string | null;
  seedTimeSeconds: number | null;
  realResultApplied?: boolean;
  team?: unknown;
  event?: unknown;
};

type MeetTeamRow = {
  id: string;
  teamId: string;
  individualScore: number;
  relayScore: number;
  divingScore: number;
  totalScore: number;
  selectedAthletes?: string | null;
  testSpotAthleteIds?: string | null;
  testSpotScoringAthleteId?: string | null;
  team: unknown;
};

type MeetForCompute = {
  scoringPlaces: number;
  meetLineups: MeetLineupRow[];
  relayEntries: RelayEntryRow[];
  meetTeams: MeetTeamRow[];
  individualScoring: Record<string, number>;
  relayScoring: Record<string, number>;
};

function getTimeLineup(l: MeetLineupRow): number {
  const sec = l.overrideTimeSeconds ?? l.seedTimeSeconds;
  if (sec != null) return sec;
  const str = l.overrideTime ?? l.seedTime;
  return str ? parseTimeToSeconds(str) : 0;
}

function getTimeRelay(r: RelayEntryRow): number {
  const sec = r.overrideTimeSeconds ?? r.seedTimeSeconds;
  if (sec != null) return sec;
  const str = r.overrideTime ?? r.seedTime;
  return str ? parseTimeToSeconds(str) : 0;
}

export interface ComputedMeetView {
  meetLineups: MeetLineupRow[];
  relayEntries: RelayEntryRow[];
  meetTeams: MeetTeamRow[];
}

/**
 * Returns meet lineups, relay entries, and meet teams with place/points/finalTime
 * (and team totals) computed for the given view mode. Does not mutate input.
 */
export function getComputedMeetView(
  meet: MeetForCompute,
  view: ViewMode,
  realResultsEventIds: string[]
): ComputedMeetView {
  const individualScoring = meet.individualScoring ?? {};
  const relayScoring = meet.relayScoring ?? {};
  const scoringPlaces = meet.scoringPlaces ?? 24;

  // Detect which events have actual results from the data itself
  const eventsWithActual = new Set<string>();
  meet.meetLineups.forEach((l) => { if (l.realResultApplied) eventsWithActual.add(l.eventId); });
  meet.relayEntries.forEach((r) => { if (r.realResultApplied) eventsWithActual.add(r.eventId); });

  const shouldSkipEvent = (eventId: string): boolean => {
    if (view === "real") return true;
    if (view === "hybrid" && eventsWithActual.has(eventId)) return true;
    return false;
  };

  const meetLineups = meet.meetLineups.map((l) => ({
    ...l,
    place: l.place,
    points: l.points,
    finalTime: l.finalTime,
    finalTimeSeconds: l.finalTimeSeconds,
  }));
  const relayEntries = meet.relayEntries.map((r) => ({
    ...r,
    place: r.place,
    points: r.points,
    finalTime: r.finalTime,
    finalTimeSeconds: r.finalTimeSeconds,
  }));

  // For "real" view: only entries with realResultApplied === true keep their data.
  // For "hybrid" view: entries in events with actual results that don't have realResultApplied
  // are cleared so only genuinely applied results contribute to the actual-event portion.
  if (view === "real") {
    meetLineups.forEach((l) => {
      if (!l.realResultApplied) {
        l.place = null;
        l.points = null;
        l.finalTime = null;
        l.finalTimeSeconds = null;
      }
    });
    relayEntries.forEach((r) => {
      if (!r.realResultApplied) {
        r.place = null;
        r.points = null;
        r.finalTime = null;
        r.finalTimeSeconds = null;
      }
    });
  } else if (view === "hybrid") {
    meetLineups.forEach((l) => {
      if (eventsWithActual.has(l.eventId) && !l.realResultApplied) {
        l.place = null;
        l.points = null;
        l.finalTime = null;
        l.finalTimeSeconds = null;
      }
    });
    relayEntries.forEach((r) => {
      if (eventsWithActual.has(r.eventId) && !r.realResultApplied) {
        r.place = null;
        r.points = null;
        r.finalTime = null;
        r.finalTimeSeconds = null;
      }
    });
  }

  const lineupsByEvent: Record<string, typeof meetLineups> = {};
  meetLineups.forEach((l) => {
    if (!lineupsByEvent[l.eventId]) lineupsByEvent[l.eventId] = [];
    lineupsByEvent[l.eventId].push(l);
  });
  const relaysByEvent: Record<string, typeof relayEntries> = {};
  relayEntries.forEach((r) => {
    if (!relaysByEvent[r.eventId]) relaysByEvent[r.eventId] = [];
    relaysByEvent[r.eventId].push(r);
  });

  for (const [eventId, lineups] of Object.entries(lineupsByEvent)) {
    if (lineups.length === 0) continue;
    if (shouldSkipEvent(eventId)) continue;

    const eventType = lineups[0].event.eventType;
    const sorted = [...lineups].sort((a, b) => {
      const aTime = getTimeLineup(a);
      const bTime = getTimeLineup(b);
      if (eventType === "diving") return bTime - aTime;
      return aTime - bTime;
    });

    let currentPlace = 1;
    for (let i = 0; i < sorted.length; i++) {
      const currentTime = getTimeLineup(sorted[i]);
      const tiedEntries: typeof sorted = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length) {
        if (Math.abs(currentTime - getTimeLineup(sorted[j])) < 0.001) {
          tiedEntries.push(sorted[j]);
          j++;
        } else break;
      }
      const tieCount = tiedEntries.length;
      const placesOccupied = Array.from({ length: tieCount }, (_, idx) => currentPlace + idx);
      const totalPoints = placesOccupied.reduce(
        (sum, place) =>
          sum + (place <= scoringPlaces ? individualScoring[place.toString()] || 0 : 0),
        0
      );
      const averagePoints = tieCount > 0 ? totalPoints / tieCount : 0;
      for (const lineup of tiedEntries) {
        lineup.place = currentPlace;
        lineup.points = averagePoints;
        lineup.finalTime = lineup.overrideTime ?? lineup.seedTime;
        lineup.finalTimeSeconds = lineup.overrideTimeSeconds ?? lineup.seedTimeSeconds;
      }
      currentPlace += tieCount;
      i = j - 1;
    }
  }

  for (const [eventId, relays] of Object.entries(relaysByEvent)) {
    if (relays.length === 0) continue;
    if (shouldSkipEvent(eventId)) continue;

    const sorted = [...relays].sort((a, b) => getTimeRelay(a) - getTimeRelay(b));
    let currentPlace = 1;
    for (let i = 0; i < sorted.length; i++) {
      const currentTime = getTimeRelay(sorted[i]);
      const tiedEntries: typeof sorted = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length) {
        if (Math.abs(currentTime - getTimeRelay(sorted[j])) < 0.001) {
          tiedEntries.push(sorted[j]);
          j++;
        } else break;
      }
      const tieCount = tiedEntries.length;
      const placesOccupied = Array.from({ length: tieCount }, (_, idx) => currentPlace + idx);
      const totalPoints = placesOccupied.reduce(
        (sum, place) => sum + (place <= scoringPlaces ? relayScoring[place.toString()] || 0 : 0),
        0
      );
      const averagePoints = tieCount > 0 ? totalPoints / tieCount : 0;
      for (const relay of tiedEntries) {
        relay.place = currentPlace;
        relay.points = averagePoints;
        relay.finalTime = relay.overrideTime ?? relay.seedTime;
        relay.finalTimeSeconds = relay.overrideTimeSeconds ?? relay.seedTimeSeconds;
      }
      currentPlace += tieCount;
      i = j - 1;
    }
  }

  const meetTeams = meet.meetTeams.map((mt) => ({ ...mt }));

  for (const meetTeam of meetTeams) {
    const selectedAthletes = meetTeam.selectedAthletes
      ? (JSON.parse(meetTeam.selectedAthletes) as string[])
      : [];
    const testSpotAthleteIds = meetTeam.testSpotAthleteIds
      ? (JSON.parse(meetTeam.testSpotAthleteIds) as string[])
      : [];
    let testSpotScoringAthleteId = meetTeam.testSpotScoringAthleteId ?? null;
    if (
      testSpotAthleteIds.length > 0 &&
      (!testSpotScoringAthleteId || !testSpotAthleteIds.includes(testSpotScoringAthleteId))
    ) {
      testSpotScoringAthleteId = testSpotAthleteIds[0];
    }
    const scoringSet = getScoringAthleteIdSet(
      selectedAthletes,
      testSpotAthleteIds,
      testSpotScoringAthleteId
    );

    const teamLineups = meetLineups.filter(
      (l) => l.athlete?.teamId === meetTeam.teamId
    );
    const teamRelays = relayEntries.filter((r) => r.teamId === meetTeam.teamId);

    const individualEntries = teamLineups.filter(
      (l) => l.event.eventType === "individual" && scoringSet.has(l.athleteId)
    );
    const divingEntries = teamLineups.filter(
      (l) => l.event.eventType === "diving" && scoringSet.has(l.athleteId)
    );

    meetTeam.individualScore = individualEntries.reduce((s, e) => s + (e.points ?? 0), 0);
    meetTeam.divingScore = divingEntries.reduce((s, e) => s + (e.points ?? 0), 0);
    meetTeam.relayScore = teamRelays.reduce((s, r) => s + (r.points ?? 0), 0);
    meetTeam.totalScore =
      meetTeam.individualScore + meetTeam.divingScore + meetTeam.relayScore;
  }

  meetTeams.sort((a, b) => b.totalScore - a.totalScore);

  return { meetLineups, relayEntries, meetTeams };
}

/** Whether the meet has any real results applied. */
export function hasRealResults(
  _meet: { meetLineups: { place: number | null }[]; relayEntries: { place: number | null }[] },
  realResultsEventIds: string[]
): boolean {
  return realResultsEventIds.length > 0;
}

/** Whether we have data to show simulated results. */
export function hasSimulatedData(meet: {
  meetLineups: unknown[];
  relayEntries: unknown[];
}): boolean {
  return meet.meetLineups.length > 0 || meet.relayEntries.length > 0;
}
