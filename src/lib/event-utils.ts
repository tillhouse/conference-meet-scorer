/**
 * Sorts events according to a custom order if provided, otherwise uses default sorting
 * @param events Array of events to sort
 * @param customOrder Optional array of event IDs in desired order
 * @returns Sorted array of events
 */
export function sortEventsByOrder<T extends { id: string; eventType?: string; name?: string }>(
  events: T[],
  customOrder: string[] | null
): T[] {
  if (!customOrder || customOrder.length === 0) {
    // No custom order, sort by type and name
    return [...events].sort((a, b) => {
      if (a.eventType !== b.eventType) {
        if (a.eventType === "individual") return -1;
        if (b.eventType === "individual") return 1;
        if (a.eventType === "relay") return -1;
        if (b.eventType === "relay") return 1;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
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

  // For events not in the custom order, sort them by type and name, then append
  const missingEvents = events.filter((e) => !seen.has(e.id));
  missingEvents.sort((a, b) => {
    if (a.eventType !== b.eventType) {
      if (a.eventType === "individual") return -1;
      if (b.eventType === "individual") return 1;
      if (a.eventType === "relay") return -1;
      if (b.eventType === "relay") return 1;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  // Append missing events at the end
  ordered.push(...missingEvents);

  return ordered;
}
