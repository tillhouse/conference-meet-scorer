/**
 * Shared relay event logic: 4 legs, distance per leg from event name, medley stroke order.
 */

export const RELAY_NUM_LEGS = 4;

/** Medley order: back, breast, fly, free. */
export const MEDLEY_STROKES = ["Back", "Breast", "Fly", "Free"] as const;

export type RelayConfig = {
  numLegs: number;
  distancePerLeg: number;
  /** For medley relays: stroke name per leg (Back, Breast, Fly, Free). Null for free relays. */
  strokes: readonly string[] | null;
};

/**
 * Derive relay config from event name.
 * - Total distance: 200 → 50m/leg, 400 → 100m/leg, 800 → 200m/leg.
 * - Medley relays: stroke order Back, Breast, Fly, Free.
 */
export function getRelayConfig(eventName: string): RelayConfig {
  const lower = (eventName ?? "").toLowerCase();
  const isMedley = /medley/i.test(lower);
  let totalDistance = 200;
  if (/\b400\b/.test(lower)) totalDistance = 400;
  else if (/\b800\b/.test(lower)) totalDistance = 800;
  const distancePerLeg = totalDistance / RELAY_NUM_LEGS;
  return {
    numLegs: RELAY_NUM_LEGS,
    distancePerLeg,
    strokes: isMedley ? MEDLEY_STROKES : null,
  };
}

/**
 * Number of 50m segments per leg (for assigning cumulative-at-50 splits to legs).
 * 50m leg → 1, 100m leg → 2, 200m leg → 4.
 */
export function getSegmentsPerLeg(distancePerLeg: number): number {
  return Math.max(1, Math.round(distancePerLeg / 50));
}

/**
 * Distance labels for split columns (e.g. 50 only for 4x50, 50 and 100 for 4x100).
 */
export function getRelayDistanceLabels(distancePerLeg: number): number[] {
  const n = getSegmentsPerLeg(distancePerLeg);
  return Array.from({ length: n }, (_, i) => (i + 1) * 50);
}
