import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseResultText,
  type IndividualRow,
  type RelayRow,
  type DivingRow,
  type ParseResult,
} from "@/lib/real-results-parser";

/**
 * Split pasted/uploaded result text into blocks by event boundaries.
 * Boundaries: line starting with "Event " (e.g. "Event 3  Women 500 Yard Freestyle") or "====".
 */
function splitByEventBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isEventStart = /^Event\s+\d+/i.test(line) || /^Event\s+\d+/.test(trimmed);
    const isSeparator = /^=+$/.test(trimmed);

    if (isEventStart && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    if (isSeparator && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }
  return blocks.filter((b) => b.trim().length > 0);
}

/**
 * Match parser event title to a meet event (by name/fullName containing key tokens).
 */
function matchEventToBlock(
  eventTitle: string | undefined,
  eventType: "individual" | "relay" | "diving",
  events: Array<{ id: string; name: string; fullName: string; eventType: string }>
): { id: string; name: string } | null {
  if (!eventTitle) return null;
  const lower = eventTitle.toLowerCase();
  const candidates = events.filter((e) => e.eventType === eventType);
  for (const e of candidates) {
    const nameLower = (e.name || "").toLowerCase();
    const fullLower = (e.fullName || "").toLowerCase();
    if (lower.includes(nameLower) || lower.includes(fullLower)) return e;
    if (nameLower.includes(lower.slice(0, 20)) || fullLower.includes(lower.slice(0, 30))) return e;
  }
  if (eventType === "relay" && /relay/i.test(lower)) {
    const medley = /medley/i.test(lower) ? candidates.find((c) => /medley/i.test((c.fullName || c.name).toLowerCase())) : null;
    const free = /free\s*relay|freestyle\s*relay/i.test(lower) ? candidates.find((c) => /free|freestyle/i.test((c.fullName || c.name).toLowerCase())) : null;
    return medley || free || candidates[0] || null;
  }
  if (eventType === "diving" && /diving|1m|3m/i.test(lower)) {
    const oneM = /1\s*[Mm]|1m/i.test(lower) ? candidates.find((c) => /1\s*[Mm]|1m/i.test((c.fullName || c.name).toLowerCase())) : null;
    return oneM || candidates[0] || null;
  }
  if (eventType === "individual") {
    const dist = lower.match(/\d+/)?.[0];
    const stroke = /free|back|breast|fly|butterfly|im|medley/i.exec(lower)?.[0];
    for (const e of candidates) {
      const n = (e.fullName || e.name).toLowerCase();
      if (dist && n.includes(dist) && (!stroke || n.includes(stroke))) return e;
    }
  }
  return candidates[0] || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file") as File | null;
    const addUnknownAthletes = formData?.get("addUnknownAthletes") !== "false";

    let text: string;
    if (file && file.size > 0) {
      text = await file.text();
    } else {
      return NextResponse.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 }
      );
    }

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      select: { id: true, selectedEvents: true },
    });
    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    const eventIds: string[] = meet.selectedEvents
      ? (JSON.parse(meet.selectedEvents) as string[])
      : [];
    const events = eventIds.length
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true, fullName: true, eventType: true },
        })
      : [];

    const blocks = splitByEventBlocks(text);
    const results: {
      eventId: string;
      eventTitle?: string;
      appliedLineups: number;
      appliedRelays: number;
      addedAthletes: number;
      unresolvedCount: number;
      parseErrors: string[];
      error?: string;
    }[] = [];
    let totalUnresolved: unknown[] = [];

    for (const block of blocks) {
      const parsed = parseResultText(block);
      const first = parsed.rows[0] as (IndividualRow | RelayRow | DivingRow) | undefined;
      let eventType: "individual" | "relay" | "diving" = "individual";
      if (first) {
        if ("score" in first && "schoolCode" in first) eventType = "diving";
        else if ("points" in first && first.points != null) eventType = "relay";
      }
      if (parsed.eventTitle && /relay/i.test(parsed.eventTitle)) eventType = "relay";
      if (parsed.eventTitle && /diving|1m|3m|diver/i.test(parsed.eventTitle)) eventType = "diving";

      const matched = matchEventToBlock(parsed.eventTitle, eventType, events);
      if (!matched) {
        results.push({
          eventId: "",
          eventTitle: parsed.eventTitle,
          appliedLineups: 0,
          appliedRelays: 0,
          addedAthletes: 0,
          unresolvedCount: parsed.rows.length,
          parseErrors: parsed.errors || [],
          error: "Could not match block to a meet event",
        });
        continue;
      }

      let baseUrl = "http://localhost:3000";
      try {
        if (request.url) baseUrl = new URL(request.url).origin;
        else if (process.env.NEXTAUTH_URL) baseUrl = process.env.NEXTAUTH_URL;
        else if (process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
      } catch {
        // keep default
      }
      const res = await fetch(
        `${baseUrl}/api/meets/${meetId}/events/${matched.id}/results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resultText: block,
            eventType,
            addUnknownAthletes,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        results.push({
          eventId: matched.id,
          eventTitle: parsed.eventTitle,
          appliedLineups: 0,
          appliedRelays: 0,
          addedAthletes: 0,
          unresolvedCount: data.unresolved?.length ?? 0,
          parseErrors: data.parseErrors || [data.error] || [],
          error: data.error || res.statusText,
        });
        if (Array.isArray(data.unresolved)) totalUnresolved.push(...data.unresolved);
        continue;
      }

      results.push({
        eventId: matched.id,
        eventTitle: parsed.eventTitle,
        appliedLineups: data.appliedLineups ?? 0,
        appliedRelays: data.appliedRelays ?? 0,
        addedAthletes: data.addedAthletes ?? 0,
        unresolvedCount: data.unresolved?.length ?? 0,
        parseErrors: data.parseErrors || [],
      });
      if (Array.isArray(data.unresolved)) totalUnresolved.push(...data.unresolved);
    }

    return NextResponse.json({
      success: true,
      eventsApplied: results.filter((r) => r.appliedLineups > 0 || r.appliedRelays > 0).length,
      results,
      totalUnresolved: totalUnresolved.length,
    });
  } catch (err) {
    console.error("Upload results error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload results" },
      { status: 500 }
    );
  }
}
