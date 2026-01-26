import { parseTimeToSeconds } from "./utils";

export interface ParsedAthlete {
  firstName: string;
  lastName: string;
  year?: string;
  isDiver: boolean;
  events: {
    eventName: string;
    time: string;
    timeSeconds: number;
  }[];
}

/**
 * Parse CSV/TXT file content into athlete data
 * Supports multiple formats:
 * - Name, Event, Time
 * - Last, First, Event, Time
 * - Name, Year, Event, Time
 * - etc.
 */
export function parseCSV(content: string): ParsedAthlete[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Try to detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("name") ||
    firstLine.includes("event") ||
    firstLine.includes("time");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  const athletesMap = new Map<string, ParsedAthlete>();

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Try comma-separated first, then tab-separated
    const parts = line.includes("\t")
      ? line.split("\t").map((p) => p.trim())
      : line.split(",").map((p) => p.trim());

    if (parts.length < 3) continue;

    // Try to parse the line
    // Common formats:
    // 1. "Last, First", "Event", "Time"
    // 2. "First Last", "Event", "Time"
    // 3. "Last, First", "Year", "Event", "Time"
    // 4. "Name", "Event", "Time", "Year", "Diver"

    let nameStr = parts[0];
    let year: string | undefined;
    let isDiver = false;
    let eventName = "";
    let time = "";

    // Check if name contains comma (Last, First format)
    if (nameStr.includes(",")) {
      const nameParts = nameStr.split(",").map((p) => p.trim());
      if (nameParts.length >= 2) {
        const lastName = nameParts[0];
        const firstName = nameParts[1];
        nameStr = `${firstName} ${lastName}`;
      }
    }

    // Try to find event and time
    // Look for time-like patterns (contains : or is a number)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this looks like a time/score
      if (
        part.includes(":") ||
        (!isNaN(parseFloat(part)) && parseFloat(part) > 0)
      ) {
        time = part;
        // Event should be before the time
        if (i > 1) {
          eventName = parts[i - 1];
        } else if (parts.length > i + 1) {
          eventName = parts[i - 1] || parts[0];
        }
        break;
      }
    }

    // If we didn't find event/time, try simpler pattern
    if (!eventName || !time) {
      if (parts.length >= 3) {
        eventName = parts[1] || "";
        time = parts[2] || "";
      }
    }

    // Check for year (FR, SO, JR, SR, GR)
    for (const part of parts) {
      const upperPart = part.toUpperCase();
      if (["FR", "SO", "JR", "SR", "GR", "FY", "SOPH", "JUNIOR", "SENIOR", "GRAD"].includes(upperPart)) {
        year = upperPart;
        break;
      }
    }

    // Check for diver flag
    for (const part of parts) {
      const lowerPart = part.toLowerCase();
      if (
        lowerPart.includes("diver") ||
        lowerPart.includes("dive") ||
        lowerPart === "d"
      ) {
        isDiver = true;
        break;
      }
    }

    // If event name contains diving events, mark as diver
    if (eventName && (eventName.includes("1M") || eventName.includes("3M"))) {
      isDiver = true;
    }

    if (!eventName || !time) {
      continue; // Skip invalid rows
    }

    // Parse name
    const nameParts = nameStr.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "";

    if (!firstName || !lastName) {
      continue; // Skip rows without valid names
    }

    const key = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;

    if (!athletesMap.has(key)) {
      athletesMap.set(key, {
        firstName,
        lastName,
        year,
        isDiver,
        events: [],
      });
    }

    const athlete = athletesMap.get(key)!;
    
    // Add event if not already present
    const timeSeconds = parseTimeToSeconds(time);
    if (!athlete.events.some((e) => e.eventName === eventName)) {
      athlete.events.push({
        eventName,
        time,
        timeSeconds,
      });
    }
  }

  return Array.from(athletesMap.values());
}
