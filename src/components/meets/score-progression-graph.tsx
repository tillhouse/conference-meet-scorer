"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp } from "lucide-react";
import { sortEventsByOrder } from "@/lib/event-utils";
import { formatTeamName } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor: string | null;
}

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface MeetLineup {
  id: string;
  eventId: string;
  points: number | null;
  athlete: {
    team: {
      id: string;
      name: string;
      schoolName?: string | null;
      primaryColor: string | null;
    };
  };
}

interface RelayEntry {
  id: string;
  eventId: string;
  points: number | null;
  team: {
    id: string;
    name: string;
    primaryColor: string | null;
  };
}

interface ScoreProgressionGraphProps {
  events: Event[];
  meetLineups: MeetLineup[];
  relayEntries: RelayEntry[];
  teams: Team[];
  eventOrder?: string[] | null | undefined;
}

interface DataPoint {
  event: string;
  eventNumber: number;
  [teamName: string]: string | number;
}

export function ScoreProgressionGraph({
  events,
  meetLineups,
  relayEntries,
  teams,
  eventOrder,
}: ScoreProgressionGraphProps) {
  const [viewMode, setViewMode] = useState<"cumulative" | "perEvent">("cumulative");

  // Calculate cumulative scores per team after each event
  const cumulativeData = useMemo(() => {
    // Sort events according to custom order
    const sortedEvents = sortEventsByOrder(events, eventOrder ?? null);

    // Initialize cumulative scores for each team
    const teamScores: Record<string, number> = {};
    teams.forEach((team) => {
      teamScores[team.id] = 0;
    });

    // Build data points for each event
    const dataPoints: DataPoint[] = [];

    sortedEvents.forEach((event, index) => {
      // Get all lineups for this event
      const eventLineups = meetLineups.filter((l) => l.eventId === event.id);
      
      // Get all relays for this event
      const eventRelays = relayEntries.filter((r) => r.eventId === event.id);

      // Calculate points for each team in this event
      const eventPoints: Record<string, number> = {};
      teams.forEach((team) => {
        eventPoints[team.id] = 0;
      });

      // Add points from individual lineups
      eventLineups.forEach((lineup) => {
        const teamId = lineup.athlete?.team?.id;
        if (teamId) {
          const points = lineup.points || 0;
          eventPoints[teamId] = (eventPoints[teamId] || 0) + points;
        }
      });

      // Add points from relays
      eventRelays.forEach((relay) => {
        const teamId = relay.team?.id;
        if (teamId) {
          const points = relay.points || 0;
          eventPoints[teamId] = (eventPoints[teamId] || 0) + points;
        }
      });

      // Update cumulative scores
      teams.forEach((team) => {
        teamScores[team.id] += eventPoints[team.id];
      });

      // Create data point for this event
      const dataPoint: DataPoint = {
        event: event.name,
        eventNumber: index + 1,
      };

      teams.forEach((team) => {
        dataPoint[formatTeamName(team.name, team.schoolName)] = teamScores[team.id];
      });

      dataPoints.push(dataPoint);
    });

    return dataPoints;
  }, [events, meetLineups, relayEntries, teams, eventOrder]);

  // Calculate points per event (non-cumulative)
  const perEventData = useMemo(() => {
    // Sort events according to custom order
    const sortedEvents = sortEventsByOrder(events, eventOrder ?? null);

    // Build data points for each event
    const dataPoints: DataPoint[] = [];

    sortedEvents.forEach((event, index) => {
      // Get all lineups for this event
      const eventLineups = meetLineups.filter((l) => l.eventId === event.id);
      
      // Get all relays for this event
      const eventRelays = relayEntries.filter((r) => r.eventId === event.id);

      // Calculate points for each team in this event
      const eventPoints: Record<string, number> = {};
      teams.forEach((team) => {
        eventPoints[team.id] = 0;
      });

      // Add points from individual lineups
      eventLineups.forEach((lineup) => {
        const teamId = lineup.athlete?.team?.id;
        if (teamId) {
          const points = lineup.points || 0;
          eventPoints[teamId] = (eventPoints[teamId] || 0) + points;
        }
      });

      // Add points from relays
      eventRelays.forEach((relay) => {
        const teamId = relay.team?.id;
        if (teamId) {
          const points = relay.points || 0;
          eventPoints[teamId] = (eventPoints[teamId] || 0) + points;
        }
      });

      // Create data point for this event (non-cumulative)
      const dataPoint: DataPoint = {
        event: event.name,
        eventNumber: index + 1,
      };

      teams.forEach((team) => {
        dataPoint[formatTeamName(team.name, team.schoolName)] = eventPoints[team.id];
      });

      dataPoints.push(dataPoint);
    });

    return dataPoints;
  }, [events, meetLineups, relayEntries, teams, eventOrder]);

  // Select data based on view mode
  const chartData = viewMode === "cumulative" ? cumulativeData : perEventData;

  // Generate colors for teams (use primaryColor if available, otherwise generate)
  const teamColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const defaultColors = [
      "#3b82f6", // blue
      "#ef4444", // red
      "#10b981", // green
      "#f59e0b", // amber
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#84cc16", // lime
    ];

    teams.forEach((team, index) => {
      const teamDisplayName = formatTeamName(team.name, team.schoolName);
      if (team.primaryColor) {
        colors[teamDisplayName] = team.primaryColor;
      } else {
        colors[teamDisplayName] = defaultColors[index % defaultColors.length];
      }
    });

    return colors;
  }, [teams]);

  // Check if we have any data to display
  const hasData = cumulativeData.length > 0 && teams.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Progression</CardTitle>
          <CardDescription>
            Team scores over the course of the meet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available. Run the meet simulation to see score progression.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Score Progression</CardTitle>
            <CardDescription>
              {viewMode === "cumulative" 
                ? "Cumulative team scores throughout the meet"
                : "Points scored per event"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "cumulative" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("cumulative")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Cumulative
            </Button>
            <Button
              variant={viewMode === "perEvent" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("perEvent")}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Per Event
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pt-6 pb-2">
        <div className="w-full h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 60,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
              <XAxis
                dataKey="event"
                angle={-90}
                textAnchor="start"
                height={90}
                className="text-xs"
                interval={0}
                tick={{ fontSize: 10, dy: 15 }}
                tickMargin={20}
              />
              <YAxis
                label={{ 
                  value: viewMode === "cumulative" ? "Cumulative Points" : "Points", 
                  angle: -90, 
                  position: "insideLeft",
                  style: { textAnchor: "middle" }
                }}
                className="text-xs"
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) => [
                  `${value ?? 0} points`,
                  "",
                ]}
                labelFormatter={(label) => `Event: ${label}`}
              />
              <Legend
                wrapperStyle={{ 
                  paddingTop: "0", 
                  paddingBottom: "0", 
                  marginTop: "0",
                  marginBottom: "0"
                }}
                iconType="line"
                verticalAlign="bottom"
              />
              {teams.map((team) => {
                const teamDisplayName = formatTeamName(team.name, team.schoolName);
                return (
                  <Line
                    key={team.id}
                    type="monotone"
                    dataKey={teamDisplayName}
                    stroke={teamColors[teamDisplayName]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
