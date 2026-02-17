/**
 * Get the set of athlete IDs whose points count toward the team total.
 * When test spot is used: selectedAthletes minus testSpotAthleteIds, plus testSpotScoringAthleteId.
 * Otherwise: all selectedAthletes.
 */
export function getScoringAthleteIdSet(
  selectedAthletes: string[],
  testSpotAthleteIds: string[],
  testSpotScoringAthleteId: string | null
): Set<string> {
  if (testSpotAthleteIds.length === 0) {
    return new Set(selectedAthletes);
  }
  const testSet = new Set(testSpotAthleteIds);
  const scoring = selectedAthletes.filter(
    (id) => !testSet.has(id) || id === testSpotScoringAthleteId
  );
  return new Set(scoring);
}
