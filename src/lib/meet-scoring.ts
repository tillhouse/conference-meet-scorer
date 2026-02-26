/**
 * Get the set of athlete IDs whose points count toward the team total.
 * When test spot is used: selectedAthletes minus testSpotAthleteIds, plus testSpotScoringAthleteId.
 * Exhibition athletes are always excluded (they don't count toward any metrics).
 */
export function getScoringAthleteIdSet(
  selectedAthletes: string[],
  testSpotAthleteIds: string[],
  testSpotScoringAthleteId: string | null,
  exhibitionAthleteIds: string[] = []
): Set<string> {
  const exhibitionSet = new Set(exhibitionAthleteIds);
  let scoring: string[];
  if (testSpotAthleteIds.length === 0) {
    scoring = selectedAthletes;
  } else {
    const testSet = new Set(testSpotAthleteIds);
    scoring = selectedAthletes.filter(
      (id) => !testSet.has(id) || id === testSpotScoringAthleteId
    );
  }
  return new Set(scoring.filter((id) => !exhibitionSet.has(id)));
}
