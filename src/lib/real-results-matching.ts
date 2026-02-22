/**
 * Match parsed result rows to meet teams and rosters.
 * - Resolve school label -> teamId
 * - Name normalization and nickname handling
 * - matchAthleteByName for individuals/diving
 */

export type AthleteForMatch = {
  id: string;
  firstName: string;
  lastName: string;
};

export type MeetTeamForMatch = {
  teamId: string;
  team: {
    schoolName?: string | null;
    shortName?: string | null;
    name: string;
  };
};

/** Build a map from school label (various forms) to teamId for the meet's teams. */
export function buildSchoolToTeamIdMap(meetTeams: MeetTeamForMatch[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mt of meetTeams) {
    const tid = mt.teamId;
    const school = (mt.team.schoolName || mt.team.name || "").trim();
    const short = (mt.team.shortName || "").trim();
    if (school) {
      map.set(school.toLowerCase(), tid);
      // First word of school (e.g. "Princeton University" -> "Princeton")
      const firstWord = school.split(/\s+/)[0];
      if (firstWord) map.set(firstWord.toLowerCase(), tid);
    }
    if (short) {
      map.set(short.toLowerCase(), tid);
      // Without suffix like -M, -W
      const base = short.split("-")[0];
      if (base) map.set(base.toLowerCase(), tid);
    }
  }
  // Common abbreviations
  const abbr: Record<string, string> = {
    harv: "harvard",
    prin: "princeton",
    penn: "penn",
    yale: "yale",
    brown: "brown",
    dart: "dartmouth",
    columbia: "columbia",
    cubc: "columbia",
    cornell: "cornell",
    coru: "cornell",
    brow: "brown",
  };
  for (const mt of meetTeams) {
    const tid = mt.teamId;
    const school = ((mt.team.schoolName || mt.team.name || "").trim()).toLowerCase();
    const firstWord = school.split(/\s+/)[0] || school;
    for (const [ab, full] of Object.entries(abbr)) {
      if (full === firstWord || school.includes(full)) {
        map.set(ab, tid);
      }
    }
  }
  return map;
}

/** Normalize "LastName, FirstName" or "FirstName LastName" to { firstName, lastName }. */
export function normalizeParsedName(parsedName: string): { firstName: string; lastName: string } {
  const s = parsedName.replace(/\s+/g, " ").trim();
  const comma = s.indexOf(",");
  if (comma >= 0) {
    const lastName = s.slice(0, comma).trim();
    const firstName = s.slice(comma + 1).trim();
    return { firstName: firstName || "", lastName: lastName || "" };
  }
  const parts = s.split(/\s+/);
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] || "", lastName: "" };
  }
  return { firstName: "", lastName: "" };
}

/** Common nickname -> formal first name (and vice versa for matching). */
const NICKNAME_MAP: Record<string, string[]> = {
  mike: ["michael"],
  michael: ["mike"],
  alex: ["alexander", "alexandra"],
  alexander: ["alex"],
  alexandra: ["alex"],
  matt: ["matthew"],
  matthew: ["matt"],
  nick: ["nicholas"],
  nicholas: ["nick"],
  sam: ["samuel", "samantha"],
  samuel: ["sam"],
  samantha: ["sam"],
  dan: ["daniel", "danielle"],
  daniel: ["dan"],
  danielle: ["dan"],
  chris: ["christopher", "christine"],
  christopher: ["chris"],
  christine: ["chris"],
  jake: ["jacob"],
  jacob: ["jake"],
  ben: ["benjamin"],
  benjamin: ["ben"],
  joe: ["joseph"],
  joseph: ["joe"],
  tom: ["thomas"],
  thomas: ["tom"],
  steve: ["steven", "stephen"],
  steven: ["steve"],
  stephen: ["steve"],
  beth: ["elizabeth"],
  elizabeth: ["beth"],
  liz: ["elizabeth"],
  kate: ["katherine", "katelyn"],
  katherine: ["kate"],
  katelyn: ["kate"],
};

function normalizeForCompare(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Expand first name to possible variants (formal + nicknames). */
function firstNameVariants(firstName: string): string[] {
  const n = normalizeForCompare(firstName);
  const set = new Set<string>([n]);
  if (NICKNAME_MAP[n]) {
    NICKNAME_MAP[n].forEach((v) => set.add(v));
  }
  for (const [nick, formals] of Object.entries(NICKNAME_MAP)) {
    if (formals.includes(n)) set.add(nick);
  }
  return Array.from(set);
}

export type MatchResult =
  | { kind: "match"; athlete: AthleteForMatch }
  | { kind: "candidates"; athletes: AthleteForMatch[] }
  | { kind: "none" };

/**
 * Match a parsed name (e.g. "Schott, Mitchell" or "Mitchell Schott") to one athlete or return candidates/none.
 * Uses: format normalization, case-insensitive, nickname expansion, then optional first-initial + lastName.
 */
export function matchAthleteByName(
  parsedName: string,
  athletes: AthleteForMatch[]
): MatchResult {
  if (athletes.length === 0) return { kind: "none" };
  const { firstName: pFirst, lastName: pLast } = normalizeParsedName(parsedName);
  const pLastN = normalizeForCompare(pLast);
  const pFirstVariants = pFirst ? firstNameVariants(pFirst) : [""];

  const exactMatches: AthleteForMatch[] = [];
  const initialMatches: AthleteForMatch[] = [];

  for (const a of athletes) {
    const aLast = normalizeForCompare(a.lastName);
    const aFirst = normalizeForCompare(a.firstName);
    if (pLastN !== aLast) continue;

    if (!pFirst) {
      exactMatches.push(a);
      continue;
    }
    if (pFirstVariants.includes(aFirst)) {
      exactMatches.push(a);
      continue;
    }
    if (aFirst.charAt(0) === pFirstVariants[0]?.charAt(0)) {
      initialMatches.push(a);
    }
  }

  if (exactMatches.length === 1) return { kind: "match", athlete: exactMatches[0] };
  if (exactMatches.length > 1) return { kind: "candidates", athletes: exactMatches };
  if (initialMatches.length === 1) return { kind: "match", athlete: initialMatches[0] };
  if (initialMatches.length > 1) return { kind: "candidates", athletes: initialMatches };
  return { kind: "none" };
}

/**
 * Resolve school label from result text to teamId using the meet's team map.
 */
export function resolveSchoolToTeamId(
  schoolLabel: string,
  schoolToTeamId: Map<string, string>
): string | null {
  const key = schoolLabel.trim().toLowerCase().replace(/\s+/g, " ");
  return schoolToTeamId.get(key) || null;
}
