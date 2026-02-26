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
  year?: string | null; // "FR", "SO", "JR", "SR", "GR" - used to disambiguate same-name athletes
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
  // Common abbreviations (Hytek format: BROW, Yale-CT, Princeton-NJ, HARV-NE, CORN, Penn-MA, Dartmouth-NE, Columbia)
  const abbr: Record<string, string> = {
    harv: "harvard",
    prin: "princeton",
    penn: "penn",
    yale: "yale",
    brown: "brown",
    dart: "dartmouth",
    columbia: "columbia",
    cubc: "columbia",
    colu: "columbia",
    cornell: "cornell",
    corn: "cornell",
    coru: "cornell",
    brow: "brown",
    upenn: "penn",
    pennsylvania: "penn",
  };
  for (const mt of meetTeams) {
    const tid = mt.teamId;
    const school = ((mt.team.schoolName || mt.team.name || "").trim()).toLowerCase();
    const name = (mt.team.name || "").trim().toLowerCase();
    const firstWord = school.split(/\s+/)[0] || school;
    for (const [ab, full] of Object.entries(abbr)) {
      if (full === firstWord || school.includes(full) || name.includes(full)) {
        map.set(ab, tid);
      }
    }
  }
  return map;
}

/** Strip trailing middle initial (single letter, optionally with period) from a first name. */
function stripMiddleInitial(firstName: string): string {
  return firstName.replace(/\s+[A-Za-z]\.?\s*$/, "").trim();
}

/** Normalize "LastName, FirstName" or "FirstName LastName" to { firstName, lastName }. */
export function normalizeParsedName(parsedName: string): { firstName: string; lastName: string } {
  const s = parsedName.replace(/\s+/g, " ").trim();
  const comma = s.indexOf(",");
  if (comma >= 0) {
    const lastName = s.slice(0, comma).trim();
    const firstName = stripMiddleInitial(s.slice(comma + 1).trim());
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
  josh: ["joshua"],
  joshua: ["josh"],
  tom: ["thomas"],
  thomas: ["tom"],
  steve: ["steven", "stephen"],
  steven: ["steve"],
  stephen: ["steve"],
  will: ["william"],
  william: ["will", "bill", "billy"],
  bill: ["william"],
  billy: ["william"],
  rob: ["robert"],
  bob: ["robert"],
  bobby: ["robert"],
  robert: ["rob", "bob", "bobby"],
  jim: ["james"],
  jimmy: ["james"],
  james: ["jim", "jimmy"],
  ed: ["edward", "edwin", "eddie"],
  eddie: ["edward", "edwin", "ed"],
  edward: ["ed", "eddie"],
  edwin: ["ed", "eddie"],
  jon: ["jonathan", "johnathan"],
  jonathan: ["jon", "john"],
  johnathan: ["jon", "john"],
  john: ["jonathan", "johnathan", "jon"],
  andy: ["andrew"],
  andrew: ["andy", "drew"],
  drew: ["andrew"],
  dave: ["david"],
  david: ["dave"],
  max: ["maximilian", "maxwell"],
  maximilian: ["max"],
  maxwell: ["max"],
  pat: ["patrick", "patricia"],
  patrick: ["pat"],
  patricia: ["pat"],
  charlie: ["charles"],
  charles: ["charlie", "chuck"],
  chuck: ["charles"],
  zach: ["zachary"],
  zachary: ["zach", "zack"],
  zack: ["zachary"],
  nate: ["nathan", "nathaniel"],
  nathan: ["nate"],
  nathaniel: ["nate"],
  tony: ["anthony"],
  anthony: ["tony"],
  gabe: ["gabriel"],
  gabriel: ["gabe"],
  beth: ["elizabeth"],
  elizabeth: ["beth", "liz"],
  liz: ["elizabeth"],
  kate: ["katherine", "katelyn"],
  katherine: ["kate"],
  katelyn: ["kate"],
  mingna: ["minga"],
  minga: ["mingna"],
};

function normalizeForCompare(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return Math.abs(m - n);
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}
/** Normalize class year for comparison: "FR", "SO", "JR", "SR", "GR" (case-insensitive). */
function normalizeYear(year: string | null | undefined): string | null {
  if (year == null || year === "") return null;
  const y = year.trim().toUpperCase();
  return ["FR", "SO", "JR", "SR", "GR"].includes(y) ? y : null;
}

/** Return true if parsed year matches athlete year (both normalized); false if either missing. */
function yearMatches(parsedYear: string | null | undefined, athleteYear: string | null | undefined): boolean {
  const p = normalizeYear(parsedYear);
  const a = normalizeYear(athleteYear);
  if (p == null || a == null) return true; // no disambiguation possible
  return p === a;
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
 * Uses: format normalization, case-insensitive, nickname expansion, optional first-initial + lastName.
 * When parsedYear is provided, class year is used to disambiguate multiple same-name athletes (e.g. two "Brian Lee")
 * or to require year match for a single initial-only match.
 */
export function matchAthleteByName(
  parsedName: string,
  athletes: AthleteForMatch[],
  parsedYear?: string | null
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
    // First-initial match: allow only when parsed first name is not a prefix of athlete's (and vice versa),
    // so "Min" never matches "Minga" and we don't overwrite 24th with 38th.
    const pFirstBase = pFirstVariants[0] ?? "";
    const oneIsPrefixOfOther =
      pFirstBase.length > 0 && aFirst.length > 0 &&
      (aFirst.startsWith(pFirstBase) || pFirstBase.startsWith(aFirst)) &&
      aFirst !== pFirstBase;
    if (!oneIsPrefixOfOther && aFirst.charAt(0) === pFirstBase.charAt(0)) {
      initialMatches.push(a);
    }
  }

  // Apply class-year disambiguation when we have multiple candidates or a single initial-only match
  const filterByYear = (list: AthleteForMatch[]): AthleteForMatch[] => {
    if (normalizeYear(parsedYear) == null) return list;
    const withYear = list.filter((a) => yearMatches(parsedYear, a.year));
    return withYear.length > 0 ? withYear : list; // if no one has matching year, keep original list
  };

  const requireYearForSingle = (athlete: AthleteForMatch): boolean => {
    if (normalizeYear(parsedYear) == null) return true;
    return yearMatches(parsedYear, athlete.year);
  };

  if (exactMatches.length === 1) {
    return { kind: "match", athlete: exactMatches[0]! };
  }
  if (exactMatches.length > 1) {
    const byYear = filterByYear(exactMatches);
    if (byYear.length === 1) return { kind: "match", athlete: byYear[0]! };
    return { kind: "candidates", athletes: exactMatches };
  }
  if (initialMatches.length === 1) {
    const only = initialMatches[0]!;
    if (!requireYearForSingle(only)) return { kind: "none" };
    return { kind: "match", athlete: only };
  }
  if (initialMatches.length > 1) {
    const byYear = filterByYear(initialMatches);
    if (byYear.length === 1) return { kind: "match", athlete: byYear[0]! };
    return { kind: "candidates", athletes: initialMatches };
  }

  // Last-name + year fallback: when first name doesn't match (e.g., different name in DB),
  // try matching by last name alone, disambiguating by class year.
  const lastNameMatches = athletes.filter((a) => normalizeForCompare(a.lastName) === pLastN);
  if (lastNameMatches.length === 1) {
    return { kind: "match", athlete: lastNameMatches[0]! };
  }
  if (lastNameMatches.length > 1) {
    const byYear = filterByYear(lastNameMatches);
    if (byYear.length === 1) return { kind: "match", athlete: byYear[0]! };
    return { kind: "candidates", athletes: lastNameMatches };
  }

  // Fuzzy last-name fallback: handle typos (e.g., "Anagnoson" vs "Anagnason")
  if (pLastN.length >= 3) {
    const fuzzyMatches = athletes.filter((a) => editDistance(normalizeForCompare(a.lastName), pLastN) <= 1);
    if (fuzzyMatches.length === 1) {
      return { kind: "match", athlete: fuzzyMatches[0]! };
    }
    if (fuzzyMatches.length > 1) {
      const byYear = filterByYear(fuzzyMatches);
      if (byYear.length === 1) return { kind: "match", athlete: byYear[0]! };
    }
  }

  return { kind: "none" };
}

/**
 * Resolve school label from result text to teamId using the meet's team map.
 * Handles common swimming result formats where teams include an LSC/state suffix
 * (e.g., "Yale-CT", "Princeton-NJ", "HARV-NE", "Penn-MA").
 */
export function resolveSchoolToTeamId(
  schoolLabel: string,
  schoolToTeamId: Map<string, string>
): string | null {
  const key = schoolLabel.trim().toLowerCase().replace(/\s+/g, " ");

  // 1. Exact match
  if (schoolToTeamId.has(key)) return schoolToTeamId.get(key)!;

  // 2. Strip LSC/state suffix (e.g., "yale-ct" → "yale", "harv-ne" → "harv")
  const withoutSuffix = key.replace(/-[a-z0-9]{2,4}$/i, "");
  if (withoutSuffix !== key && schoolToTeamId.has(withoutSuffix)) {
    return schoolToTeamId.get(withoutSuffix)!;
  }

  // 3. Try first token before any hyphen or space
  const firstToken = key.split(/[-\s]/)[0];
  if (firstToken) {
    if (schoolToTeamId.has(firstToken)) return schoolToTeamId.get(firstToken)!;
    // Also try when firstToken differs from key (e.g. "princeton" from "princeton-nj")
    if (firstToken !== key && firstToken !== withoutSuffix && schoolToTeamId.has(firstToken)) {
      return schoolToTeamId.get(firstToken)!;
    }
  }

  // 4. Prefix match: map key starts with term or vice versa (min 3 chars to avoid false positives)
  const searchTerms = [withoutSuffix, firstToken].filter((s) => s && s.length >= 3);
  for (const term of searchTerms) {
    for (const [mapKey, teamId] of schoolToTeamId) {
      if (mapKey.length >= 3 && (mapKey.startsWith(term) || term.startsWith(mapKey))) return teamId;
    }
  }

  return null;
}
