/**
 * Parsers for standard meet result text formats (individual swimming, relay, diving).
 * Used when applying real results to a meet.
 */

export type IndividualRow = {
  place: number;
  name: string; // raw as in file, e.g. "LastName, FirstName"
  school: string;
  timeStr: string;
  points?: number | null; // optional, when finals format includes Points column
};

export type RelayRow = {
  place: number;
  school: string;
  timeStr: string;
  points: number | null;
};

export type DivingRow = {
  place: number;
  name: string;
  schoolCode: string; // e.g. HARV, PRIN
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

/**
 * Parse individual swimming results (prelims and finals).
 * Prelims: place, name, year, school, seed, prelims time.
 * Finals: place, name, year, school, prelims, finals time, points (optional column).
 * Continuation lines (splits) start with "r:" or digits in parens - skip.
 * Flexible: optional "!" after time, variable spacing, optional trailing points.
 */
export function parseIndividualSwimming(text: string): ParseResult<IndividualRow> {
  const errors: string[] = [];
  const rows: IndividualRow[] = [];
  const lines = text.split(/\r?\n/);
  let eventTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Event title: non-empty, doesn't start with digit, not separator
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

    // Skip headers and section labels
    if (
      trimmed.startsWith("===") ||
      /Name\s+Year\s+School/i.test(trimmed) ||
      /Preliminaries|Finals|Prelims|===.*Final/i.test(trimmed)
    ) {
      continue;
    }

    // Skip continuation/split lines (r: or leading parens with numbers)
    if (/^\s*r:|\s+\(\d+\.\d+\)/.test(line) || /^\s+\d+\.\d+\s+\(\d+\.\d+\)/.test(trimmed)) {
      continue;
    }

    // Data line: place, name, year, school, then one or two times (seed/prelims, prelims/finals), optional points
    // Finals: "  1 Bastone, Alexandra     JR Harvard           4:43.07    4:40.94   32  " -> use 4:40.94 (rightmost time)
    // Prelims: "  1 Moehn, Anna            SR Penn              4:43.58    4:42.96  " -> use 4:42.96
    // Time can have optional ! (e.g. 4:40.94 or 1:28.31!)
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
      // Use the rightmost token that looks like a swim time: contains ":" (e.g. 1:55.62) or decimal (e.g. 22.07 for sub-minute)
      // Exclude the trailing points integer (e.g. 32) by only considering tokens that have ":" or decimal seconds
      const isSwimTime = (t: string) => t.includes(":") || /^\d+\.\d+$/.test(t);
      const swimTimes = allTokens.filter(isSwimTime);
      const timeStr =
        swimTimes.length >= 1
          ? swimTimes[swimTimes.length - 1]
          : "";
      if (timeStr) {
        rows.push({ place, name, school, timeStr, points: points ?? undefined });
        continue;
      }
    }

    // Fallback: place, name, year, school, single time at end
    const fallback = line.match(/^\s*(\d+)\s+(.+?)\s+(SR|JR|FR|SO|GR)\s+([A-Za-z]+)\s+([\d:.]+)!?\s*$/i);
    if (fallback) {
      rows.push({
        place: parseInt(fallback[1], 10),
        name: trim(fallback[2]),
        school: fallback[4].trim(),
        timeStr: fallback[5].replace("!", "").trim(),
      });
    }
  }

  return { eventTitle, rows, errors };
}

/**
 * Parse relay results (prelims or finals).
 * Data lines: place, School 'A', seed time, finals time, optional points.
 * Flexible: optional @ or ! after time, variable spacing.
 */
export function parseRelay(text: string): ParseResult<RelayRow> {
  const errors: string[] = [];
  const rows: RelayRow[] = [];
  const lines = text.split(/\r?\n/);
  let eventTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!eventTitle && /relay/i.test(trimmed) && !/^\d+\s/.test(trimmed)) {
      eventTitle = trimmed;
      continue;
    }
    if (trimmed.startsWith("===") || /School\s+Seed\s+Finals/i.test(trimmed)) continue;
    if (/^\s*\d+\)\s/.test(trimmed) || /^r:\s*\+/.test(trimmed)) continue;

    // Place, school 'A', seed, finals time, optional points. Time may have @ or !
    const relayLineRe = /^\s*(\d+)\s+(.+?)\s+([\d:.]+)\s+([\d:.@!]+)\s*(\d+)?\s*$/;
    const m = line.match(relayLineRe);
    if (m) {
      let school = trim(m[2]).replace(/\s*'[AB]'\s*$/i, "").trim();
      rows.push({
        place: parseInt(m[1], 10),
        school,
        timeStr: m[4].replace(/[@!]/g, "").trim(),
        points: m[5] ? parseInt(m[5], 10) : null,
      });
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
        let score = points != null && scores.length >= 2 ? scores[scores.length - 2] : scores[scores.length - 1];
        score = score.replace(/^X/i, "").trim();
        if (score) rows.push({ place, name, schoolCode, score });
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
