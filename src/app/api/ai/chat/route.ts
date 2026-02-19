import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic, isAnthropicConfigured, getAnthropicModel } from "@/lib/anthropic";
import { z } from "zod";

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  message: z.string().min(1, "Message cannot be empty"),
  meetId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
});

// POST: Send a message and get AI response
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAnthropicConfigured()) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const data = sendMessageSchema.parse(body);

    // Get or create chat session
    let chatSession;
    if (data.sessionId) {
      chatSession = await prisma.chatSession.findUnique({
        where: { id: data.sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!chatSession) {
        return NextResponse.json(
          { error: "Chat session not found" },
          { status: 404 }
        );
      }
    } else {
      // Create new session
      chatSession = await prisma.chatSession.create({
        data: {
          meetId: data.meetId || null,
          teamId: data.teamId || null,
          title: data.message.substring(0, 50) + (data.message.length > 50 ? "..." : ""),
        },
        include: {
          messages: true,
        },
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "user",
        content: data.message,
      },
    });

    // Use meet/team from request or from session so follow-up messages keep context
    const meetIdForContext = data.meetId ?? chatSession.meetId ?? null;
    const teamIdForContext = data.teamId ?? chatSession.teamId ?? null;

    // Build context from meet/team if provided
    let systemPrompt = `You are an expert swimming and diving coach assistant focused on meet strategy. You have full meet data when provided: standings, results (places and points), test spot comparisons, and sensitivity analysis (baseline vs better/worse).

Use this data to:
- Suggest lineup and relay optimizations (who to put in which events, test spot tradeoffs).
- Explain tradeoffs and risk: who is most at risk of losing points if they go slightly slower or score lower (sensitivity "worse"), and who is best positioned to gain points with a small improvement (sensitivity "better").
- Reference concrete numbers from the context (team totals, individual points, places) when giving advice.

Be concise, practical, and coach-oriented.`;

    if (meetIdForContext) {
      const meet = await prisma.meet.findUnique({
        where: { id: meetIdForContext },
        include: {
          meetTeams: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  schoolName: true,
                },
              },
            },
            orderBy: { totalScore: "desc" },
          },
          meetLineups: {
            include: {
              athlete: {
                include: {
                  team: {
                    select: { id: true, name: true },
                  },
                },
              },
              event: {
                select: { id: true, name: true, eventType: true },
              },
            },
          },
          relayEntries: {
            include: {
              team: { select: { id: true, name: true } },
              event: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (meet) {
        const formatName = (first: string | null, last: string | null) =>
          [first, last].filter(Boolean).join(" ").trim() || "—";
        const athleteIdToName = new Map<string, string>();
        meet.meetLineups.forEach((l) => {
          const a = l.athlete;
          if (a?.id)
            athleteIdToName.set(a.id, formatName(a.firstName, a.lastName));
        });

        const pointsByAthleteId = new Map<string, number>();
        meet.meetLineups.forEach((l) => {
          const cur = pointsByAthleteId.get(l.athleteId) ?? 0;
          pointsByAthleteId.set(l.athleteId, cur + (l.points ?? 0));
        });

        const lineupsByEvent: Record<string, typeof meet.meetLineups> = {};
        meet.meetLineups.forEach((lineup) => {
          const key = lineup.event.name;
          if (!lineupsByEvent[key]) lineupsByEvent[key] = [];
          lineupsByEvent[key].push(lineup);
        });
        const relaysByEvent: Record<string, typeof meet.relayEntries> = {};
        meet.relayEntries.forEach((relay) => {
          const key = relay.event.name;
          if (!relaysByEvent[key]) relaysByEvent[key] = [];
          relaysByEvent[key].push(relay);
        });

        const hasResults =
          meet.meetLineups.some((l) => l.place != null) ||
          meet.relayEntries.some((r) => r.place != null);

        let meetContext = `\n\n=== MEET STRATEGY CONTEXT ===
Meet: ${meet.name}
Type: ${meet.meetType}
Date: ${meet.date ? new Date(meet.date).toLocaleDateString() : "Not set"}
Location: ${meet.location || "Not set"}

CONSTRAINTS:
- Max Athletes per Team: ${meet.maxAthletes}
- Max Individual Events per Athlete: ${meet.maxIndivEvents}
- Max Relays per Athlete: ${meet.maxRelays}
- Max Diving Events per Diver: ${meet.maxDivingEvents}
- Scoring Places: ${meet.scoringPlaces}
- Scoring Start Points: ${meet.scoringStartPoints}
- Relay Multiplier: ${meet.relayMultiplier}x

STANDINGS (by total score):`;
        meet.meetTeams.forEach((mt, i) => {
          meetContext += `\n${i + 1}. ${mt.team.name}${mt.team.shortName ? ` (${mt.team.shortName})` : ""}: ${mt.totalScore.toFixed(1)} pts`;
          meetContext += ` (indiv: ${mt.individualScore.toFixed(1)}, diving: ${mt.divingScore.toFixed(1)}, relay: ${mt.relayScore.toFixed(1)})`;
        });

        if (hasResults) {
          meetContext += `\n\nRESULTS SUMMARY (top 3 per event):`;
          Object.entries(lineupsByEvent).forEach(([eventName, lineups]) => {
            const sorted = [...lineups].sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
            const top = sorted.slice(0, 3);
            meetContext += `\n- ${eventName}:`;
            top.forEach((l) => {
              const time = l.overrideTime ?? l.seedTime ?? "—";
              meetContext += ` ${l.place ?? "?"}. ${formatName(l.athlete.firstName, l.athlete.lastName)} (${time}) ${(l.points ?? 0).toFixed(1)} pts`;
            });
          });
          Object.entries(relaysByEvent).forEach(([eventName, relays]) => {
            const sorted = [...relays].sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
            const top = sorted.slice(0, 3);
            meetContext += `\n- ${eventName} (relay):`;
            top.forEach((r) => {
              const time = r.overrideTime ?? r.seedTime ?? "—";
              meetContext += ` ${r.place ?? "?"}. ${r.team.name} (${time}) ${(r.points ?? 0).toFixed(1)} pts`;
            });
          });
        }

        const teamsWithTestSpot = meet.meetTeams.filter((mt) => {
          const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
          if (!raw) return false;
          try {
            return (JSON.parse(raw) as string[]).length > 0;
          } catch {
            return false;
          }
        });
        if (teamsWithTestSpot.length > 0) {
          meetContext += `\n\nTEST SPOT SUMMARY:`;
          teamsWithTestSpot.forEach((mt) => {
            const raw = (mt as { testSpotAthleteIds?: string | null }).testSpotAthleteIds;
            const testSpotIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];
            const scoringId = (mt as { testSpotScoringAthleteId?: string | null }).testSpotScoringAthleteId ?? testSpotIds[0];
            const currentTotal = mt.totalScore;
            const scoringPts = pointsByAthleteId.get(scoringId ?? "") ?? 0;
            meetContext += `\n- ${mt.team.name}:`;
            testSpotIds.forEach((aid) => {
              const name = athleteIdToName.get(aid) ?? aid;
              const pts = pointsByAthleteId.get(aid) ?? 0;
              const teamTotalIfScoring = currentTotal - scoringPts + pts;
              meetContext += ` ${name} ${pts.toFixed(1)} pts (team total if scoring: ${teamTotalIfScoring.toFixed(1)});`;
            });
          });
        }

        const teamsWithSensitivity = meet.meetTeams.filter((mt) => {
          const raw = (mt as { sensitivityResults?: string | null }).sensitivityResults;
          if (!raw) return false;
          try {
            return (JSON.parse(raw) as unknown[]).length > 0;
          } catch {
            return false;
          }
        });
        if (teamsWithSensitivity.length > 0) {
          meetContext += `\n\nSENSITIVITY ANALYSIS:`;
          type SensResult = { athleteId: string; teamTotalBetter: number; teamTotalWorse: number; athletePtsBaseline: number; athletePtsBetter: number; athletePtsWorse: number };
          teamsWithSensitivity.forEach((mt) => {
            const pct = (mt as { sensitivityPercent?: number | null }).sensitivityPercent ?? 1;
            const results: SensResult[] = (mt as { sensitivityResults?: string | null }).sensitivityResults
              ? (JSON.parse((mt as { sensitivityResults: string }).sensitivityResults) as SensResult[])
              : [];
            const teamBase = mt.totalScore;
            results.forEach((r) => {
              const name = athleteIdToName.get(r.athleteId) ?? r.athleteId;
              meetContext += `\n- ${mt.team.name} — ${name} (±${pct}%):`;
              meetContext += ` baseline ${r.athletePtsBaseline.toFixed(1)} pts (team ${teamBase.toFixed(1)});`;
              meetContext += ` better ${r.athletePtsBetter.toFixed(1)} pts (team ${r.teamTotalBetter.toFixed(1)});`;
              meetContext += ` worse ${r.athletePtsWorse.toFixed(1)} pts (team ${r.teamTotalWorse.toFixed(1)}).`;
            });
          });
        }

        meetContext += `\n\nCONDENSED LINEUPS (events and times${hasResults ? ", points" : ""}):`;
        const athletesByTeam: Record<string, Record<string, typeof meet.meetLineups>> = {};
        meet.meetLineups.forEach((lineup) => {
          const teamName = lineup.athlete.team.name;
          const athleteName = formatName(lineup.athlete.firstName, lineup.athlete.lastName);
          if (!athletesByTeam[teamName]) athletesByTeam[teamName] = {};
          if (!athletesByTeam[teamName][athleteName]) athletesByTeam[teamName][athleteName] = [];
          athletesByTeam[teamName][athleteName].push(lineup);
        });
        Object.entries(athletesByTeam).forEach(([teamName, athletes]) => {
          meetContext += `\n${teamName}:`;
          Object.entries(athletes).forEach(([athleteName, lineups]) => {
            const parts = lineups.map((l) => {
              const t = l.overrideTime ?? l.seedTime ?? "—";
              return hasResults && l.points != null ? `${l.event.name} (${t}) ${l.points.toFixed(1)} pts` : `${l.event.name} (${t})`;
            });
            meetContext += `\n  - ${athleteName}: ${parts.join("; ")}`;
          });
        });

        if (meet.relayEntries.length > 0) {
          meetContext += `\n\nRELAYS:`;
          const relayByTeam: Record<string, typeof meet.relayEntries> = {};
          meet.relayEntries.forEach((r) => {
            if (!relayByTeam[r.team.name]) relayByTeam[r.team.name] = [];
            relayByTeam[r.team.name].push(r);
          });
          Object.entries(relayByTeam).forEach(([teamName, entries]) => {
            const parts = entries.map((e) => `${e.event.name} (${e.overrideTime ?? e.seedTime ?? "—"})${hasResults && e.points != null ? ` ${e.points.toFixed(1)} pts` : ""}`);
            meetContext += `\n- ${teamName}: ${parts.join("; ")}`;
          });
        }

        systemPrompt += meetContext;
      }
    }

    // Add team context if provided
    if (teamIdForContext) {
      const team = await prisma.team.findUnique({
        where: { id: teamIdForContext },
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
                orderBy: {
                  timeSeconds: "asc",
                },
              },
            },
            orderBy: [
              { lastName: "asc" },
              { firstName: "asc" },
            ],
          },
          _count: {
            select: {
              athletes: true,
            },
          },
        },
      });

      if (team) {
        let teamContext = `\n\n=== CURRENT TEAM CONTEXT ===
Team: ${team.name}${team.shortName ? ` (${team.shortName})` : ""}
School: ${team.schoolName || "Not set"}
Roster Size: ${team.athletes.length} athletes`;

        // Add athlete information
        if (team.athletes.length > 0) {
          teamContext += `\n\nATHLETES (${team.athletes.length}):`;
          
          team.athletes.forEach((athlete) => {
            const bestEvents = athlete.eventTimes
              .slice(0, 5) // Top 5 events
              .map(et => `${et.event.name} (${et.time})`)
              .join(", ");
            
            teamContext += `\n- ${athlete.firstName} ${athlete.lastName}${athlete.year ? ` (${athlete.year})` : ""}${athlete.isDiver ? " [Diver]" : ""}`;
            if (bestEvents) {
              teamContext += `\n  Best Events: ${bestEvents}`;
            }
          });
        }

        systemPrompt += teamContext;
      }
    }

    // Build conversation history
    const conversationHistory = chatSession.messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Add the current user message
    conversationHistory.push({
      role: "user",
      content: data.message,
    });

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationHistory.slice(-10), // Keep last 10 messages for context
    });

    const assistantMessage =
      response.content[0].type === "text"
        ? response.content[0].text
        : "I apologize, but I couldn't generate a text response.";

    // Save assistant response
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "assistant",
        content: assistantMessage,
      },
    });

    // Update session timestamp
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      sessionId: chatSession.id,
      message: assistantMessage,
      model: response.model,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET: Get chat session history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(chatSession);
  } catch (error) {
    console.error("Get chat session error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}
