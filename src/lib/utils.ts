import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Parse time string to seconds (e.g., "4:15.32" -> 255.32)
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  
  // Check if it's a diving score (just a number)
  if (!str.includes(":")) {
    return parseFloat(str) || 0;
  }
  
  // Parse swimming time (MM:SS.ss or SS.ss)
  const parts = str.split(":");
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  
  return parseFloat(str) || 0;
}

// Format seconds to time string (e.g., 255.32 -> "4:15.32")
// Format: mm:ss.00 (no leading zeros for minutes, always 2 decimal places)
export function formatSecondsToTime(seconds: number, isDiving: boolean = false): string {
  if (isDiving) {
    return seconds.toFixed(2);
  }
  
  if (seconds < 60) {
    return seconds.toFixed(2);
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, "0");
  // No leading zero for minutes
  return `${mins}:${secs}`;
}

// Normalize time string to mm:ss.00 format (no leading zeros for minutes, always 2 decimal places)
// Handles various input formats: "04:24.1", "4:24.1", "4:24.10", "04:24.10", etc.
export function normalizeTimeFormat(timeStr: string): string {
  if (!timeStr) return timeStr;
  const str = String(timeStr).trim();
  
  // If it's a diving score (no colon), return as-is
  if (!str.includes(":")) {
    return str;
  }
  
  // Parse the time
  const parts = str.split(":");
  if (parts.length !== 2) {
    return str; // Return original if format is unexpected
  }
  
  const minutes = parseInt(parts[0], 10);
  const secondsStr = parts[1];
  
  // Parse seconds and ensure 2 decimal places
  const seconds = parseFloat(secondsStr);
  if (isNaN(seconds) || isNaN(minutes)) {
    return str; // Return original if parsing fails
  }
  
  // Format seconds with 2 decimal places, padded to 5 characters (SS.00)
  const formattedSeconds = seconds.toFixed(2).padStart(5, "0");
  
  // Return without leading zero for minutes
  return `${minutes}:${formattedSeconds}`;
}

// Format athlete name (Last, First -> First Last)
export function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

// Format team name - default to school name if available, otherwise use team name
// This prioritizes school name for display while keeping team name distinction in backend
export function formatTeamName(name: string, schoolName?: string | null): string {
  return schoolName || name;
}

// Short label for relay column (e.g. "PRIN", "PRIN-A"). Uses team shortName if present (e.g. "PRIN-M" -> "PRIN"), else derives from first word of school/team name.
export function formatTeamRelayLabel(team: {
  name: string;
  schoolName?: string | null;
  shortName?: string | null;
}): string {
  if (team.shortName && team.shortName.trim()) {
    const base = team.shortName.trim().split("-")[0];
    if (base) return base.toUpperCase();
  }
  const full = (team.schoolName || team.name).trim();
  const firstWord = full.split(/\s+/)[0] || full;
  return firstWord.slice(0, 4).toUpperCase();
}

// Normalize event name to standard format
// Handles variations like "500 FR" -> "500 Free", "200 BK" -> "200 Back", etc.
export function normalizeEventName(eventName: string): string {
  if (!eventName) return eventName;
  
  const trimmed = eventName.trim();
  
  // Handle relay events
  if (trimmed.toLowerCase().includes("relay")) {
    return trimmed; // Keep relay names as-is for now
  }
  
  // Handle diving events
  if (trimmed.toLowerCase().includes("diving") || 
      trimmed.toLowerCase().includes("1m") || 
      trimmed.toLowerCase().includes("3m") ||
      trimmed.toLowerCase().includes("platform")) {
    return trimmed; // Keep diving names as-is for now
  }
  
  // Extract distance and stroke abbreviation
  // Pattern: "500 FR" or "500 Free" or "200 IM" etc.
  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!match) return trimmed; // Return as-is if pattern doesn't match
  
  const distance = match[1];
  const stroke = match[2].trim().toUpperCase();
  
  // Map stroke abbreviations to full names
  const strokeMap: Record<string, string> = {
    "FR": "Free",
    "FREE": "Free",
    "BK": "Back",
    "BACK": "Back",
    "BR": "Breast",
    "BREAST": "Breast",
    "FL": "Fly",
    "FLY": "Fly",
    "BUTTERFLY": "Fly",
    "IM": "IM",
    "INDIVIDUAL MEDLEY": "IM",
  };
  
  const normalizedStroke = strokeMap[stroke] || stroke;
  
  return `${distance} ${normalizedStroke}`;
}

// Find event by name with normalization (handles variations)
export function findEventByName(events: Array<{ id: string; name: string }>, eventName: string): { id: string; name: string } | undefined {
  if (!eventName) return undefined;
  
  // First try exact match
  let found = events.find((e) => e.name === eventName);
  if (found) return found;
  
  // Try case-insensitive match
  const lowerEventName = eventName.toLowerCase();
  found = events.find((e) => e.name.toLowerCase() === lowerEventName);
  if (found) return found;
  
  // Try normalized match
  const normalized = normalizeEventName(eventName);
  found = events.find((e) => {
    const normalizedExisting = normalizeEventName(e.name);
    return normalizedExisting === normalized || normalizedExisting.toLowerCase() === normalized.toLowerCase();
  });
  
  return found;
}

// Scoring tables
export const DEFAULT_INDIVIDUAL_SCORING: Record<number, number> = {
  1: 32, 2: 28, 3: 27, 4: 26, 5: 25, 6: 24, 7: 23, 8: 22,
  9: 20, 10: 17, 11: 16, 12: 15, 13: 14, 14: 13, 15: 12,
  16: 11, 17: 9, 18: 7, 19: 6, 20: 5, 21: 4, 22: 3, 23: 2, 24: 1
};

export const DEFAULT_RELAY_SCORING: Record<number, number> = {
  1: 64, 2: 56, 3: 54, 4: 52, 5: 50, 6: 48, 7: 46, 8: 44
};
