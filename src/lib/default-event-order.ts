/**
 * Default event order for championship meets
 * This is the standard order used in most championship swim meets
 */
export const DEFAULT_CHAMPIONSHIP_EVENT_ORDER = [
  "200 Medley Relay",
  "800 Free Relay",
  "500 Free",
  "200 IM",
  "50 Free",
  "1M Diving",
  "200 Free Relay",
  "1000 Free",
  "100 Fly",
  "400 IM",
  "200 Free",
  "100 Breast",
  "100 Back",
  "400 Medley Relay",
  "1650 Free",
  "200 Back",
  "100 Free",
  "200 Breast",
  "200 Fly",
  "3M Diving",
  "400 Free Relay",
];

/**
 * Get the default event order for a meet type
 * @param meetType - "championship" or "dual"
 * @returns Array of event names in default order, or empty array if no default
 */
export function getDefaultEventOrder(meetType: "championship" | "dual"): string[] {
  if (meetType === "championship") {
    return [...DEFAULT_CHAMPIONSHIP_EVENT_ORDER];
  }
  // Dual meets don't have a default order - users set it manually
  return [];
}
