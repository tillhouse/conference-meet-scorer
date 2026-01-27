import { parseTimeToSeconds, normalizeTimeFormat } from "./utils";

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
 * Parse CSV file in the Princeton roster format:
 * - First row: empty
 * - Second row: headers (First Name, Last Name, Class Year, Swimmer or Diver, then event columns)
 * - Subsequent rows: athlete data
 */
export function parseCSV(content: string): ParsedAthlete[] {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  
  if (lines.length < 2) return [];

  // Find the header row (should be row 1, but skip empty rows)
  let headerRowIndex = -1;
  let headerRow: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    if (lowerLine.includes("first name") && lowerLine.includes("last name")) {
      headerRowIndex = i;
      headerRow = lines[i].split(",").map((col) => col.trim());
      break;
    }
  }

  if (headerRowIndex === -1 || headerRow.length < 4) {
    return [];
  }

  // Map header columns to indices
  const firstNameIndex = headerRow.findIndex((h) => h.toLowerCase().includes("first name"));
  const lastNameIndex = headerRow.findIndex((h) => h.toLowerCase().includes("last name"));
  const classYearIndex = headerRow.findIndex((h) => h.toLowerCase().includes("class year") || h.toLowerCase().includes("year"));
  const swimmerDiverIndex = headerRow.findIndex((h) => h.toLowerCase().includes("swimmer") || h.toLowerCase().includes("diver"));
  
  // Find event columns (everything after the first 4 columns that's not empty)
  const eventColumns: { index: number; name: string }[] = [];
  for (let i = Math.max(firstNameIndex, lastNameIndex, classYearIndex, swimmerDiverIndex) + 1; i < headerRow.length; i++) {
    const header = headerRow[i].trim();
    if (header && header.length > 0) {
      eventColumns.push({ index: i, name: header });
    }
  }

  if (firstNameIndex === -1 || lastNameIndex === -1) {
    return [];
  }

  const athletes: ParsedAthlete[] = [];
  const currentYear = new Date().getFullYear();

  // Process data rows (everything after header)
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const parts = line.split(",").map((p) => p.trim());

    // Skip rows that don't have at least first name and last name
    if (parts.length <= Math.max(firstNameIndex, lastNameIndex)) continue;

    const firstName = parts[firstNameIndex]?.trim();
    const lastName = parts[lastNameIndex]?.trim();

    if (!firstName || !lastName || firstName.length === 0 || lastName.length === 0) {
      continue;
    }

    // Get class year and convert to FR/SO/JR/SR/GR format
    let year: string | undefined;
    if (classYearIndex !== -1 && parts[classYearIndex]) {
      const classYearStr = parts[classYearIndex].trim();
      if (classYearStr) {
        const classYear = parseInt(classYearStr);
        if (!isNaN(classYear)) {
          const yearsUntilGraduation = classYear - currentYear;
          if (yearsUntilGraduation === 0) year = "SR";
          else if (yearsUntilGraduation === 1) year = "JR";
          else if (yearsUntilGraduation === 2) year = "SO";
          else if (yearsUntilGraduation === 3) year = "FR";
          else if (yearsUntilGraduation < 0) year = "GR";
          else year = "FR"; // Default for future years
        }
      }
    }

    // Determine if diver
    let isDiver = false;
    if (swimmerDiverIndex !== -1 && parts[swimmerDiverIndex]) {
      const swimmerDiver = parts[swimmerDiverIndex].toLowerCase().trim();
      isDiver = swimmerDiver.includes("diver");
    }

    // Collect events with times
    const events: { eventName: string; time: string; timeSeconds: number }[] = [];

    for (const eventCol of eventColumns) {
      if (eventCol.index < parts.length) {
        const timeValue = parts[eventCol.index]?.trim();
        
        // Skip empty cells
        if (!timeValue || timeValue.length === 0) continue;

        // Skip if it's just a dash or other placeholder
        if (timeValue === "-" || timeValue === "N/A" || timeValue === "NA") continue;

        // Parse the time/score
        const timeSeconds = parseTimeToSeconds(timeValue);
        
        // Only add if we got a valid time/score
        if (timeSeconds > 0) {
          // Normalize time format to mm:ss.00 (no leading zeros, always 2 decimals)
          const normalizedTime = normalizeTimeFormat(timeValue);
          
          events.push({
            eventName: eventCol.name,
            time: normalizedTime,
            timeSeconds,
          });
        }
      }
    }

    // If athlete has no events, still add them (they might be added later)
    // But if they have events, definitely add them
    if (events.length > 0 || firstName || lastName) {
      athletes.push({
        firstName,
        lastName,
        year,
        isDiver,
        events,
      });
    }
  }

  return athletes;
}
