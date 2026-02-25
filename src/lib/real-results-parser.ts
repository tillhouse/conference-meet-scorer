/**
 * Parsers for standard meet result text formats (individual swimming, relay, diving).
 * Used when applying real results to a meet.
 */

import { getRelayConfig, getSegmentsPerLeg, RELAY_NUM_LEGS } from "@/lib/relay-utils";

export type IndividualRow = {
  place: number;
  name: string; // raw as in file, e.g. "LastName, FirstName"
  school: string;
  year?: string | null; // class year from file: "FR", "SO", "JR", "SR", "GR"
  timeStr: string;
  points?: number | null; // optional, when finals format includes Points column
  // Parsed from Hytek continuation lines when present
  reactionTimeSeconds?: number | null;
  cumulativeSplits?: string[];
  subSplits?: string[];
};

export type RelayLeg = {
  reactionTimeSeconds: number | null;
  name: string;
  cumulativeLeg: string[];
  subSplits?: string[];
};

export type RelayRow = {
  place: number | null; // null when DQ (disqualified)
  school: string;
  timeStr: string; // finals time, or "DQ" / "XDQ" when disqualified
  points: number | null;
  disqualified?: boolean;
  // Parsed from Hytek swimmer/split lines when present
  legs?: RelayLeg[];
  relayCumulativeAt50?: string[];
};

export type DivingRow = {
  place: number;
  name: string;
  schoolCode: string; // e.g. HARV, PRIN
  year?: string | null; // "FR", "SO", "JR", "SR", "GR" when present in format
  score: string;
};

export type ParsedRow = IndividualRow | RelayRow | DivingRow;

export type ParseResult<T extends ParsedRow = ParsedRow> = {
  eventTitle?: string;
  rows: T[];
  errors: string[];
};

function trim(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Parse reaction time from "r:+0.72" or "r:0.15" or "r:-0.10"; returns seconds or null. */
function parseReactionTime(line: string): number | null {
  const m = line.match(/r:\s*([+-]?\d+\.?\d*)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** Match "cum (sub)" or lone "cum". Times are MM.SS or M:MM.SS so we don't match "4" as cum and "27.91" as sub. */
const TIME_PART = "\\d{1,2}(?::\\d{1,2})?(?:\\.\\d{2})?";
const CUM_SUB_RE = new RegExp(
  `(${TIME_PART})\\s*\\((${TIME_PART})\\)|(${TIME_PART})`,
  "g"
);

/**
 * From continuation lines (after a main data line), parse cumulative splits and sub-splits.
 * Format: first line may have "r:+0.72  25.88  53.75 (27.87)"; then "1:21.95 (28.20)  1:50.63 (28.68)".
 * First number is cumulative at 50 (and sub for first 50); then pairs of cumulative (sub).
 * Strips leading "r:..." so reaction time is not parsed as the first split.
 */
function parseIndividualSplitsFromLines(lines: string[]): {
  reactionTimeSeconds: number | null;
  cumulativeSplits: string[];
  subSplits: string[];
} {
  let reactionTimeSeconds: number | null = null;
  const cumulativeSplits: string[] = [];
  const subSplits: string[] = [];
  for (const line of lines) {
    const r = parseReactionTime(line);
    if (r !== null) reactionTimeSeconds = r;
    // Strip leading "r:+0.83" etc. so it is not captured as the first split
    const lineWithoutReaction = line.replace(/^\s*r:[+-]?\d+\.?\d*\s*/i, "");
    CUM_SUB_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CUM_SUB_RE.exec(lineWithoutReaction)) !== null) {
      if (match[1] !== undefined && match[2] !== undefined) {
        cumulativeSplits.push(match[1].trim());
        subSplits.push(match[2].trim());
      } else if (match[3] !== undefined) {
        const cum = match[3].trim();
        cumulativeSplits.push(cum);
        if (cumulativeSplits.length === 1) subSplits.push(cum);
      }
    }
  }
  // If we have one more cumulative than sub (e.g. last "4:40.94 (27.91)" split across lines), derive last sub
  if (cumulativeSplits.length > 0 && cumulativeSplits.length === subSplits.length + 1) {
    const prevCum = cumulativeSplits[cumulativeSplits.length - 2];
    const lastCum = cumulativeSplits[cumulativeSplits.length - 1];
    const prevSec = parseTimeToSecondsForSplit(prevCum ?? "");
    const lastSec = parseTimeToSecondsForSplit(lastCum ?? "");
    if (prevSec != null && lastSec != null && lastSec >= prevSec) {
      subSplits.push(secondsToSplitString(lastSec - prevSec));
    } else {
      subSplits.push(lastCum ?? "");
    }
  }
  return { reactionTimeSeconds, cumulativeSplits, subSplits };
}

/** True if line looks like start of a new swimmer (place + name + year + school). */
function isIndividualDataLine(line: string): boolean {
  return /^\s*\d+\s+.+?\s+(SR|JR|FR|SO|GR)\s+[A-Za-z]+\s+/i.test(line.trim());
}

/** True if line is a continuation (splits/reaction) for the previous swimmer. */
function isIndividualContinuationLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\s*r:/.test(line)) return true;
  if (/^\s*\d+\.\d+/.test(t) || /^\s*\d+:\d+/.test(t)) return true;
  return false;
}

/**
 * Parse individual swimming results (prelims and finals).
 * Prelims: place, name, year, school, seed, prelims time.
 * Finals: place, name, year, school, prelims, finals time, points (optional column).
 * When split lines follow (r:..., cumulative (sub)), they are parsed and attached to the last row.
 */
export function parseIndividualSwimming(text: string): ParseResult<IndividualRow> {
  const errors: string[] = [];
  const rows: IndividualRow[] = [];
  const lines = text.split(/\r?\n/);
  let eventTitle: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i++;
    if (!trimmed) continue;

    // Event title
    if (!eventTitle && !/^\d+\s/.test(trimmed) && !trimmed.startsWith("===")) {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes("freestyle") || lower.includes("backstroke") ||
        lower.includes("breaststroke") || lower.includes("butterfly") ||
        lower.includes("individual medley") || lower.includes("event ") ||
        lower.includes("relay")
      ) {
        eventTitle = trimmed;
        continue;
      }
    }

    if (
      trimmed.startsWith("===") ||
      /Name\s+Year\s+School/i.test(trimmed) ||
      /Preliminaries|Finals|Prelims|===.*Final/i.test(trimmed)
    ) {
      continue;
    }

    // Data line: place, name, year, school, then times
    const timeLike = /[\d:.]+!?/g;
    const leading = line.match(/^\s*(\d+)\s+(.+?)\s+(SR|JR|FR|SO|GR)\s+([A-Za-z]+)\s+/i);
    if (leading) {
      const place = parseInt(leading[1], 10);
      const name = trim(leading[2]);
      const school = leading[4].trim();
      const rest = line.slice(line.indexOf(leading[4]) + leading[4].length).trim();
      const allTokens: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = timeLike.exec(rest)) !== null) {
        allTokens.push(m[0].replace("!", "").trim());
      }
      const trailingInt = rest.match(/\s+(\d{1,2})\s*$/);
      const points = trailingInt ? parseInt(trailingInt[1], 10) : null;
      // Swim time: has colon (e.g. 2:01.43) or is seconds with exactly two decimals (e.g. 55.32). Exclude points-like values (e.g. 13.5, 32).
      const isSwimTime = (t: string) =>
        t.includes(":") || (/^\d+\.\d{2}$/.test(t) && parseFloat(t) >= 10);
      const swimTimes = allTokens.filter(isSwimTime);
      const timeStr = swimTimes.length >= 1 ? swimTimes[swimTimes.length - 1] : "";
      // If last token looks like points (e.g. 13.5 or 32), use it when trailing integer didn't match
      let parsedPoints: number | undefined = points ?? undefined;
      if (parsedPoints == null && allTokens.length > 0) {
        const lastToken = allTokens[allTokens.length - 1]!;
        const v = parseFloat(lastToken);
        if (Number.isFinite(v) && v >= 0 && v <= 60 && (v % 1 === 0 || (v * 2) % 1 === 0))
          parsedPoints = v;
      }
      if (timeStr) {
        const year = leading[3] ? String(leading[3]).trim().toUpperCase() : null;
        const row: IndividualRow = { place, name, school, timeStr, points: parsedPoints, year: year ?? undefined };
        const continuationLines: string[] = [];
        while (i < lines.length && isIndividualContinuationLine(lines[i]) && !isIndividualDataLine(lines[i])) {
          continuationLines.push(lines[i]);
          i++;
        }
        if (continuationLines.length > 0) {
          const parsed = parseIndividualSplitsFromLines(continuationLines);
          if (parsed.cumulativeSplits.length > 0 || parsed.subSplits.length > 0 || parsed.reactionTimeSeconds != null) {
            row.reactionTimeSeconds = parsed.reactionTimeSeconds ?? undefined;
            row.cumulativeSplits = parsed.cumulativeSplits.length > 0 ? parsed.cumulativeSplits : undefined;
            row.subSplits = parsed.subSplits.length > 0 ? parsed.subSplits : undefined;
          }
        }
        rows.push(row);
        continue;
      }
    }

    const fallback = line.match(/^\s*(\d+)\s+(.+?)\s+(SR|JR|FR|SO|GR)\s+([A-Za-z]+)\s+([\d:.]+)!?\s*$/i);
    if (fallback) {
      const year = fallback[3] ? String(fallback[3]).trim().toUpperCase() : null;
      const row: IndividualRow = {
        place: parseInt(fallback[1], 10),
        name: trim(fallback[2]),
        school: fallback[4].trim(),
        timeStr: fallback[5].replace("!", "").trim(),
        year: year ?? undefined,
      };
      const continuationLines: string[] = [];
      while (i < lines.length && isIndividualContinuationLine(lines[i]) && !isIndividualDataLine(lines[i])) {
        continuationLines.push(lines[i]);
        i++;
      }
      if (continuationLines.length > 0) {
        const parsed = parseIndividualSplitsFromLines(continuationLines);
        if (parsed.cumulativeSplits.length > 0 || parsed.subSplits.length > 0 || parsed.reactionTimeSeconds != null) {
          row.reactionTimeSeconds = parsed.reactionTimeSeconds ?? undefined;
          row.cumulativeSplits = parsed.cumulativeSplits.length > 0 ? parsed.cumulativeSplits : undefined;
          row.subSplits = parsed.subSplits.length > 0 ? parsed.subSplits : undefined;
        }
      }
      rows.push(row);
    }
  }

  return { eventTitle, rows, errors };
}

/** True if line looks like relay team result (place, school, seed, finals). */
function isRelayTeamLine(line: string): boolean {
  return /^\s*\d+\s+.+?\s+[\d:.]+\s+[\d:.@!]+\s*(\d+)?\s*$/.test(line.trim());
}

/** True if line looks like a DQ relay line: "-- School  'A'  seed  XDQ" (trailing content allowed) */
function isRelayDQLine(line: string): boolean {
  return /^\s*--\s+.+\s+[\d:.]+\s+(XDQ|DQ)/i.test(line.trim());
}

// Allow \s* before $ so "4) ... JR  " (trailing space) still matches; (?=\s*\d+\)|\s*$)
const SWIMMER_SEGMENT_RE = /\d+\)\s*(?:r:([+-]?\d+\.?\d*)\s+)?(.+?)\s+(SR|JR|FR|SO|GR)(?=\s*\d+\)|\s*$)/gi;

/** Parse one "1) Mostek, Anya SR" or "2) r:0.15 Marakovic, Aliana FR" segment. */
function parseRelaySwimmerSegment(segment: string): { name: string; reactionTimeSeconds: number | null } | null {
  const m = segment.match(/\d+\)\s*(?:r:([+-]?\d+\.?\d*)\s+)?(.+?)\s+(SR|JR|FR|SO|GR)\s*$/i);
  if (!m) return null;
  const reaction = m[1] != null ? parseFloat(m[1]) : null;
  return {
    name: trim(m[2]),
    reactionTimeSeconds: reaction != null && Number.isFinite(reaction) ? reaction : null,
  };
}

/** Extract all "N) Name Year" segments from a line (may contain multiple swimmers). */
function parseRelaySwimmerLine(line: string): { name: string; reactionTimeSeconds: number | null }[] {
  const results: { name: string; reactionTimeSeconds: number | null }[] = [];
  SWIMMER_SEGMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SWIMMER_SEGMENT_RE.exec(line)) !== null) {
    const parsed = parseRelaySwimmerSegment(match[0]);
    if (parsed) results.push(parsed);
  }
  return results;
}

const SWIMMER_LINE_RE = /^\s*\d+\)\s+/;
const SPLIT_LINE_RE = /r:\s*[+-]?\d+\.?\d*|\d+\.\d+|\d+:\d+\.?\d*/;

/**
 * From relay continuation lines, parse legs (names + reactions) and split block.
 * Uses eventTitle to determine distance per leg so splits are assigned to the correct leg (4 legs).
 * Returns { legs, relayCumulativeAt50 } with legs always length 4.
 */
function parseRelaySplitsFromLines(
  lines: string[],
  leadOffReaction: number | null,
  eventTitle?: string
): { legs: RelayLeg[]; relayCumulativeAt50: string[] } {
  const legs: RelayLeg[] = [];
  const relayCumulativeAt50: string[] = [];
  const splitLines: string[] = [];

  for (const line of lines) {
    if (SWIMMER_LINE_RE.test(line)) {
      const parsedList = parseRelaySwimmerLine(line);
      for (const parsed of parsedList) {
        legs.push({
          reactionTimeSeconds: parsed.reactionTimeSeconds,
          name: parsed.name,
          cumulativeLeg: [],
          subSplits: [],
        });
      }
      continue;
    }
    if (SPLIT_LINE_RE.test(line)) splitLines.push(line);
  }

  if (legs.length > 0 && leadOffReaction !== null) legs[0].reactionTimeSeconds = leadOffReaction;

  const config = getRelayConfig(eventTitle ?? "");
  const segmentsPerLeg = getSegmentsPerLeg(config.distancePerLeg);

  // Strip leading "r:+0.57" (reaction) from the first split line so it is not parsed as a split time
  const combined = splitLines
    .map((line, idx) => (idx === 0 ? line.replace(/^\s*r:[+-]?\d+\.?\d*\s*/i, "") : line))
    .join(" ");
  CUM_SUB_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CUM_SUB_RE.exec(combined)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      relayCumulativeAt50.push(match[1].trim());
      const sub = match[2].trim();
      const segmentIndex = relayCumulativeAt50.length - 1;
      const legIdx = Math.min(Math.floor(segmentIndex / segmentsPerLeg), RELAY_NUM_LEGS - 1);
      if (legIdx >= 0 && legIdx < RELAY_NUM_LEGS) {
        while (legs.length <= legIdx) {
          legs.push({
            reactionTimeSeconds: null,
            name: "",
            cumulativeLeg: [],
            subSplits: [],
          });
        }
        if (!legs[legIdx].subSplits) legs[legIdx].subSplits = [];
        legs[legIdx].subSplits!.push(sub);
      }
    } else if (match[3] !== undefined) {
      relayCumulativeAt50.push(match[3].trim());
      const segmentIndex = relayCumulativeAt50.length - 1;
      const legIdx = Math.min(Math.floor(segmentIndex / segmentsPerLeg), RELAY_NUM_LEGS - 1);
      if (legIdx >= 0 && legIdx < RELAY_NUM_LEGS) {
        while (legs.length <= legIdx) {
          legs.push({
            reactionTimeSeconds: null,
            name: "",
            cumulativeLeg: [],
            subSplits: [],
          });
        }
        if (!legs[legIdx].subSplits) legs[legIdx].subSplits = [];
        // Lone cumulative: first segment use as-is (cum = sub); later segments derive sub = this_cum - prev_cum
        let subToPush: string;
        if (segmentIndex === 0) {
          subToPush = match[3].trim();
        } else {
          const prevCum = relayCumulativeAt50[segmentIndex - 1];
          const prevSec = parseTimeToSecondsForSplit(prevCum);
          const currSec = parseTimeToSecondsForSplit(match[3].trim());
          if (prevSec != null && currSec != null && currSec >= prevSec) {
            subToPush = secondsToSplitString(currSec - prevSec);
          } else {
            subToPush = match[3].trim();
          }
        }
        legs[legIdx].subSplits!.push(subToPush);
      }
    }
  }

  for (let j = 0; j < legs.length; j++) {
    const leg = legs[j];
    if (leg.subSplits && leg.subSplits.length > 0) {
      let cum = 0;
      const cumLeg: string[] = [];
      for (const s of leg.subSplits) {
        const sec = parseTimeToSecondsForSplit(s);
        if (sec != null) {
          cum += sec;
          cumLeg.push(secondsToSplitString(cum));
        }
      }
      leg.cumulativeLeg = cumLeg;
    }
  }

  // Always expose exactly 4 legs: pad with empty or slice
  const padded: RelayLeg[] = [...legs];
  while (padded.length < RELAY_NUM_LEGS) {
    padded.push({
      reactionTimeSeconds: null,
      name: "",
      cumulativeLeg: [],
      subSplits: [],
    });
  }
  return { legs: padded.slice(0, RELAY_NUM_LEGS), relayCumulativeAt50 };
}

function parseTimeToSecondsForSplit(s: string): number | null {
  const parts = s.split(":");
  if (parts.length === 1) {
    const v = parseFloat(parts[0]);
    return Number.isFinite(v) ? v : null;
  }
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const sec = parseFloat(parts[1]);
    if (Number.isFinite(min) && Number.isFinite(sec)) return min * 60 + sec;
  }
  return null;
}

function secondsToSplitString(sec: number): string {
  if (sec < 60) return sec.toFixed(2);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/**
 * Parse relay results (prelims or finals).
 * Data lines: place, School 'A', seed time, finals time, optional points.
 * When swimmer lines and split lines follow, they are parsed and attached.
 */
export function parseRelay(text: string): ParseResult<RelayRow> {
  const errors: string[] = [];
  const rows: RelayRow[] = [];
  const lines = text.split(/\r?\n/);
  let eventTitle: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i++;
    if (!trimmed) continue;

    if (!eventTitle && /relay/i.test(trimmed) && !/^\d+\s/.test(trimmed)) {
      eventTitle = trimmed;
      continue;
    }
    if (trimmed.startsWith("===") || /School\s+Seed\s+Finals/i.test(trimmed)) continue;

    // DQ relay line: "-- Yale  'A'  3:20.80  XDQ" (allow trailing text after XDQ/DQ)
    const dqRelayRe = /^\s*--\s+(.+?)\s+([\d:.]+)\s+(XDQ|DQ)/i;
    const dqMatch = trimmed.match(dqRelayRe);
    if (dqMatch) {
      let school = trim(dqMatch[1]).replace(/\s*'[AB]'\s*$/i, "").trim();
      const row: RelayRow = {
        place: null,
        school,
        timeStr: "DQ",
        points: 0,
        disqualified: true,
      };
      const continuationLines: string[] = [];
      while (i < lines.length && !isRelayTeamLine(lines[i]) && !isRelayDQLine(lines[i])) {
        const next = lines[i];
        if (next.trim().startsWith("---")) break;
        if (next.trim() !== "") continuationLines.push(next);
        i++;
      }
      if (continuationLines.length > 0) {
        const leadOffRe = continuationLines.find((l) => /r:\s*[+-]?\d+\.?\d*/.test(l));
        const leadOffReaction = leadOffRe ? parseReactionTime(leadOffRe) : null;
        const parsed = parseRelaySplitsFromLines(continuationLines, leadOffReaction, eventTitle);
        if (parsed.legs.length > 0 || parsed.relayCumulativeAt50.length > 0) {
          row.legs = parsed.legs.length > 0 ? parsed.legs : undefined;
          row.relayCumulativeAt50 = parsed.relayCumulativeAt50.length > 0 ? parsed.relayCumulativeAt50 : undefined;
        }
      }
      rows.push(row);
      continue;
    }

    const relayLineRe = /^\s*(\d+)\s+(.+?)\s+([\d:.]+)\s+([\d:.@!]+)\s*(\d+)?\s*$/;
    const m = line.match(relayLineRe);
    if (m) {
      let school = trim(m[2]).replace(/\s*'[AB]'\s*$/i, "").trim();
      const row: RelayRow = {
        place: parseInt(m[1], 10),
        school,
        timeStr: m[4].replace(/[@!]/g, "").trim(),
        points: m[5] ? parseInt(m[5], 10) : null,
      };
      const continuationLines: string[] = [];
      while (i < lines.length && !isRelayTeamLine(lines[i]) && !isRelayDQLine(lines[i])) {
        const next = lines[i];
        if (next.trim().startsWith("---")) break;
        // Do not break on blank line: swimmer lines are often split with a blank in between; skip blanks and keep collecting
        if (next.trim() !== "") continuationLines.push(next);
        i++;
      }
      if (continuationLines.length > 0) {
        const leadOffRe = continuationLines.find((l) => /r:\s*[+-]?\d+\.?\d*/.test(l));
        const leadOffReaction = leadOffRe ? parseReactionTime(leadOffRe) : null;
        const parsed = parseRelaySplitsFromLines(continuationLines, leadOffReaction, eventTitle);
        if (parsed.legs.length > 0 || parsed.relayCumulativeAt50.length > 0) {
          row.legs = parsed.legs.length > 0 ? parsed.legs : undefined;
          row.relayCumulativeAt50 = parsed.relayCumulativeAt50.length > 0 ? parsed.relayCumulativeAt50 : undefined;
        }
      }
      rows.push(row);
    }
  }

  return { eventTitle, rows, errors };
}

/**
 * Parse diving results. Multiple formats:
 * 1) Tab-separated: Place, Score, Diver Name (SCHOOL)
 * 2) Space-separated: "1 293.65 Nina Janmyr (HARV)"
 * 3) Swim meet style: place, name, year, school, seed, prelims [finals] [points] (like individual events)
 *    e.g. "  1 Janmyr, Nina           SR Harvard            334.43     293.65  " or with Finals Points column
 */
export function parseDiving(text: string): ParseResult<DivingRow> {
  const errors: string[] = [];
  const rows: DivingRow[] = [];
  const lines = text.split(/\r?\n/);
  let eventTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!eventTitle && /diving|1\s*m|3\s*m|1m|3m|mtr\s+diving|championship/i.test(trimmed) && !/^\d+\s/.test(trimmed) && !/^Place\s+Score/i.test(trimmed)) {
      eventTitle = trimmed;
      continue;
    }
    if (/^Place\s+Score\s+Diver/i.test(trimmed) || /Event\s*$/i.test(trimmed)) continue;
    if (trimmed.startsWith("===") || /===.*Final|Preliminaries/i.test(trimmed)) continue;
    if (/^\s*r:|\s+\(\d+\.\d+\)/.test(line)) continue;
    if (/^\s*--\s+/.test(trimmed)) continue;

    // Format 1: Tab-separated - place, score, name (SCHOOL)
    const parts = trimmed.split(/\t+/);
    if (parts.length >= 3) {
      const place = parseInt(parts[0].trim(), 10);
      if (!isNaN(place)) {
        const score = parts[1].trim();
        const namePart = parts[2].trim();
        const schoolMatch = namePart.match(/\s*\(([A-Za-z]+)\)\s*$/);
        const schoolCode = schoolMatch ? schoolMatch[1].toUpperCase() : "";
        const name = schoolMatch ? namePart.replace(/\s*\([A-Za-z]+\)\s*$/, "").trim() : namePart;
        rows.push({ place, name, schoolCode, score });
      }
      continue;
    }

    // Format 2: Space-separated "1 293.65 Name (SCHOOL)" or "1 293.65 Name"
    const spaceMatch = trimmed.match(/^(\d+)\s+([\d.]+)\s+(.+)$/);
    if (spaceMatch) {
      const place = parseInt(spaceMatch[1], 10);
      const score = spaceMatch[2];
      const namePart = spaceMatch[3].trim();
      const schoolMatch = namePart.match(/\s*\(([A-Za-z]+)\)\s*$/);
      const schoolCode = schoolMatch ? schoolMatch[1].toUpperCase() : "";
      const name = schoolMatch ? namePart.replace(/\s*\([A-Za-z]+\)\s*$/, "").trim() : namePart;
      rows.push({ place, name, schoolCode, score });
      continue;
    }

    // Format 3: Swim meet style - place, name, year, school, then score(s) and optional points
    // "  1 Janmyr, Nina           SR Harvard            334.43     293.65  " or "  1 Martinkus, Charlotte   SR Princeton          277.05     318.45!  32  "
    const leading = line.match(/^\s*(\d+)\s+(.+?)\s+(SR|JR|FR|SO|GR)\s+([A-Za-z]+)\s+/i);
    if (leading) {
      const place = parseInt(leading[1], 10);
      const name = trim(leading[2]);
      const schoolCode = leading[4].trim().toUpperCase();
      const rest = line.slice(line.indexOf(leading[4]) + leading[4].length).trim();
      // Scores: decimals like 293.65, 318.45!, or X188.10; optional trailing integer (points)
      const numTokens = rest.match(/X?[\d.]+!?/g) || [];
      const trailingInt = rest.match(/\s+(\d{1,2})\s*$/);
      const points = trailingInt ? parseInt(trailingInt[1], 10) : null;
      const scores = numTokens.map((s) => s.replace(/^X/i, "").replace("!", "").trim());
      if (scores.length >= 1) {
        const year = leading[3] ? String(leading[3]).trim().toUpperCase() : null;
        let score = points != null && scores.length >= 2 ? scores[scores.length - 2] : scores[scores.length - 1];
        score = score.replace(/^X/i, "").trim();
        if (score) rows.push({ place, name, schoolCode, score, year: year ?? undefined });
      }
    }
  }

  return { eventTitle, rows, errors };
}

export type EventTypeHint = "individual" | "relay" | "diving";

/**
 * Parse result text with optional event type hint.
 * If eventType is not provided, attempts to detect from content (relay/diving keywords, else individual).
 */
export function parseResultText(
  text: string,
  eventType?: EventTypeHint
): ParseResult<IndividualRow> | ParseResult<RelayRow> | ParseResult<DivingRow> {
  const lower = text.toLowerCase();
  const detected: EventTypeHint =
    eventType ||
    (/\brelay\b/.test(lower) ? "relay" : /diving|1m|3m|1\s*m\s|3\s*m\s|mtr\s+diving|diver\s+name|place\s+score\s+diver/i.test(lower) ? "diving" : "individual");

  switch (detected) {
    case "relay":
      return parseRelay(text);
    case "diving":
      return parseDiving(text);
    default:
      return parseIndividualSwimming(text);
  }
}
