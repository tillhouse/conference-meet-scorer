/**
 * Sorts events according to a custom order if provided, otherwise uses default sorting
 * @param events Array of events to sort
 * @param customOrder Optional array of event IDs in desired order
 * @returns Sorted array of events
 */
export function sortEventsByOrder<T extends { id: string }>(
  events: T[],
  customOrder: string[] | null
): T[] {
  if (!customOrder || customOrder.length === 0) {
    // No custom order, return events as-is (they should already be sorted by the query)
    return [...events];
  }

  // Create a map for quick lookup
  const eventMap = new Map(events.map((e) => [e.id, e]));
  
  // Sort by custom order
  const ordered: T[] = [];
  const seen = new Set<string>();

  // Add events in custom order
  for (const eventId of customOrder) {
    const event = eventMap.get(eventId);
    if (event) {
      ordered.push(event);
      seen.add(eventId);
    }
  }

  // Add any events not in the custom order at the end
  for (const event of events) {
    if (!seen.has(event.id)) {
      ordered.push(event);
    }
  }

  return ordered;
}
