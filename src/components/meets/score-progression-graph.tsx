"use client";

import { useMemo } from "react";
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
import { sortEventsByOrder } from "@/lib/event-utils";

interface Team {
  id: string;
  name: string;
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
  eventOrder?: string[] | null;
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
  // Calculate cumulative scores per team after each event
  const chartData = useMemo(() => {
    // Sort events according to custom order
    const sortedEvents = sortEventsByOrder(events, eventOrder);

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
        dataPoint[team.name] = teamScores[team.id];
      });

      dataPoints.push(dataPoint);
    });

    return dataPoints;
  }, [events, meetLineups, relayEntries, teams, eventOrder]);

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
      if (team.primaryColor) {
        colors[team.name] = team.primaryColor;
      } else {
        colors[team.name] = defaultColors[index % defaultColors.length];
      }
    });

    return colors;
  }, [teams]);

  // Check if we have any data to display
  const hasData = chartData.length > 0 && teams.length > 0;

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
        <CardTitle>Score Progression</CardTitle>
        <CardDescription>
          Cumulative team scores throughout the meet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
              <XAxis
                dataKey="event"
                angle={-45}
                textAnchor="end"
                height={80}
                className="text-xs"
                interval={0}
              />
              <YAxis
                label={{ value: "Cumulative Points", angle: -90, position: "insideLeft" }}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number, name: string) => [
                  `${value} points`,
                  name,
                ]}
                labelFormatter={(label) => `Event: ${label}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="line"
              />
              {teams.map((team) => (
                <Line
                  key={team.id}
                  type="monotone"
                  dataKey={team.name}
                  stroke={teamColors[team.name]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
