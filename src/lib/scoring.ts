// Generate scoring table based on configuration
export function generateScoringTable(
  places: number,
  startPoints: number,
  relayMultiplier: number = 2.0
): {
  individual: Record<number, number>;
  relay: Record<number, number>;
} {
  const individual: Record<number, number> = {};
  const relay: Record<number, number> = {};

  // Generate individual scoring
  // For 24 places: 32, 28, 27, 26, 25, 24, 23, 22, 20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1
  // For 16 places: 20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1
  
  if (places === 24) {
    // Standard 24-place scoring (A, B, C finals)
    individual[1] = startPoints;
    individual[2] = startPoints - 4;
    individual[3] = startPoints - 5;
    individual[4] = startPoints - 6;
    individual[5] = startPoints - 7;
    individual[6] = startPoints - 8;
    individual[7] = startPoints - 9;
    individual[8] = startPoints - 10;
    individual[9] = startPoints - 12;
    individual[10] = startPoints - 15;
    individual[11] = startPoints - 16;
    individual[12] = startPoints - 17;
    individual[13] = startPoints - 18;
    individual[14] = startPoints - 19;
    individual[15] = startPoints - 20;
    individual[16] = startPoints - 21;
    individual[17] = startPoints - 23;
    individual[18] = startPoints - 25;
    individual[19] = startPoints - 26;
    individual[20] = startPoints - 27;
    individual[21] = startPoints - 28;
    individual[22] = startPoints - 29;
    individual[23] = startPoints - 30;
    individual[24] = startPoints - 31;
  } else if (places === 16) {
    // 16-place scoring (A, B finals)
    individual[1] = startPoints;
    individual[2] = startPoints - 3;
    individual[3] = startPoints - 4;
    individual[4] = startPoints - 5;
    individual[5] = startPoints - 6;
    individual[6] = startPoints - 7;
    individual[7] = startPoints - 8;
    individual[8] = startPoints - 9;
    individual[9] = startPoints - 11;
    individual[10] = startPoints - 13;
    individual[11] = startPoints - 14;
    individual[12] = startPoints - 15;
    individual[13] = startPoints - 16;
    individual[14] = startPoints - 17;
    individual[15] = startPoints - 18;
    individual[16] = startPoints - 19;
  } else {
    // Generic scoring - linear decrease
    for (let i = 1; i <= places; i++) {
      individual[i] = Math.max(1, startPoints - (i - 1));
    }
  }

  // Generate relay scoring (multiply individual by relay multiplier)
  for (let i = 1; i <= Math.min(places, 8); i++) {
    relay[i] = Math.round(individual[i] * relayMultiplier);
  }

  return { individual, relay };
}

// Default scoring tables
export const DEFAULT_24_PLACE_SCORING = generateScoringTable(24, 32, 2.0);
export const DEFAULT_16_PLACE_SCORING = generateScoringTable(16, 20, 2.0);
