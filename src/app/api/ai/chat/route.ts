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

    // Build context from meet/team if provided
    let systemPrompt = `You are an expert swimming and diving coach assistant helping with meet strategy, lineup optimization, and team management. 
You have deep knowledge of:
- Swimming and diving meet formats (championship, dual, invitational)
- Event limits and roster constraints
- Scoring systems and point maximization
- Athlete performance analysis
- Strategic lineup decisions

Be helpful, concise, and practical in your advice.`;

    if (data.meetId) {
      const meet = await prisma.meet.findUnique({
        where: { id: data.meetId },
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
            orderBy: {
              totalScore: "desc",
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
                      shortName: true,
                    },
                  },
                },
              },
              event: {
                select: {
                  id: true,
                  name: true,
                  fullName: true,
                  eventType: true,
                },
              },
            },
          },
          relayEntries: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                },
              },
              event: {
                select: {
                  id: true,
                  name: true,
                  fullName: true,
                  eventType: true,
                },
              },
            },
          },
        },
      });

      if (meet) {
        // Parse selected events
        const selectedEvents = meet.selectedEvents
          ? (JSON.parse(meet.selectedEvents) as string[])
          : [];

        // Group lineups by event
        const lineupsByEvent: Record<string, typeof meet.meetLineups> = {};
        meet.meetLineups.forEach((lineup) => {
          if (!lineupsByEvent[lineup.event.name]) {
            lineupsByEvent[lineup.event.name] = [];
          }
          lineupsByEvent[lineup.event.name].push(lineup);
        });

        // Group lineups by team
        const lineupsByTeam: Record<string, typeof meet.meetLineups> = {};
        meet.meetLineups.forEach((lineup) => {
          const teamName = lineup.athlete.team.name;
          if (!lineupsByTeam[teamName]) {
            lineupsByTeam[teamName] = [];
          }
          lineupsByTeam[teamName].push(lineup);
        });

        // Build detailed context
        let meetContext = `\n\n=== CURRENT MEET CONTEXT ===
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

TEAMS PARTICIPATING (${meet.meetTeams.length}):`;

        // Add team information
        meet.meetTeams.forEach((meetTeam, index) => {
          const teamLineups = lineupsByTeam[meetTeam.team.name] || [];
          const athleteCount = meetTeam.selectedAthletes
            ? (JSON.parse(meetTeam.selectedAthletes) as string[]).length
            : 0;
          
          meetContext += `\n${index + 1}. ${meetTeam.team.name}${meetTeam.team.shortName ? ` (${meetTeam.team.shortName})` : ""}`;
          meetContext += `\n   - Roster: ${athleteCount} athletes selected`;
          meetContext += `\n   - Individual Entries: ${teamLineups.length} entries`;
          meetContext += `\n   - Current Score: ${meetTeam.totalScore.toFixed(1)} points`;
        });

        // Add event breakdown
        meetContext += `\n\nEVENTS IN THIS MEET (${Object.keys(lineupsByEvent).length}):`;
        Object.entries(lineupsByEvent).forEach(([eventName, lineups]) => {
          meetContext += `\n- ${eventName}: ${lineups.length} entries`;
          
          // Show top 3 entries by seed time
          const sortedLineups = [...lineups].sort((a, b) => {
            const aTime = a.seedTimeSeconds ?? Infinity;
            const bTime = b.seedTimeSeconds ?? Infinity;
            return aTime - bTime;
          });
          
          if (sortedLineups.length > 0 && sortedLineups[0].seedTime) {
            meetContext += ` (Top: ${sortedLineups[0].athlete.firstName} ${sortedLineups[0].athlete.lastName} - ${sortedLineups[0].seedTime} from ${sortedLineups[0].athlete.team.name})`;
          }
        });

        // Add relay information
        if (meet.relayEntries.length > 0) {
          meetContext += `\n\nRELAYS (${meet.relayEntries.length}):`;
          const relaysByEvent: Record<string, typeof meet.relayEntries> = {};
          meet.relayEntries.forEach((relay) => {
            if (!relaysByEvent[relay.event.name]) {
              relaysByEvent[relay.event.name] = [];
            }
            relaysByEvent[relay.event.name].push(relay);
          });
          
          Object.entries(relaysByEvent).forEach(([eventName, relays]) => {
            meetContext += `\n- ${eventName}: ${relays.length} teams`;
            const sortedRelays = [...relays].sort((a, b) => {
              const aTime = a.seedTimeSeconds ?? Infinity;
              const bTime = b.seedTimeSeconds ?? Infinity;
              return aTime - bTime;
            });
            if (sortedRelays[0].seedTime) {
              meetContext += ` (Top: ${sortedRelays[0].team.name} - ${sortedRelays[0].seedTime})`;
            }
          });
        }

        // Add detailed athlete lineup information
        if (meet.meetLineups.length > 0) {
          meetContext += `\n\nDETAILED LINEUPS:\n`;
          
          // Group by team, then by athlete
          const athletesByTeam: Record<string, Record<string, typeof meet.meetLineups>> = {};
          meet.meetLineups.forEach((lineup) => {
            const teamName = lineup.athlete.team.name;
            const athleteName = `${lineup.athlete.firstName} ${lineup.athlete.lastName}`;
            
            if (!athletesByTeam[teamName]) {
              athletesByTeam[teamName] = {};
            }
            if (!athletesByTeam[teamName][athleteName]) {
              athletesByTeam[teamName][athleteName] = [];
            }
            athletesByTeam[teamName][athleteName].push(lineup);
          });

          Object.entries(athletesByTeam).forEach(([teamName, athletes]) => {
            meetContext += `\n${teamName}:`;
            Object.entries(athletes).forEach(([athleteName, lineups]) => {
              const events = lineups.map(l => `${l.event.name}${l.seedTime ? ` (${l.seedTime})` : ""}`).join(", ");
              meetContext += `\n  - ${athleteName}: ${events}`;
            });
          });
        }

        systemPrompt += meetContext;
      }
    }

    // Add team context if provided
    if (data.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: data.teamId },
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
