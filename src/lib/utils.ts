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

// Scoring tables
export const DEFAULT_INDIVIDUAL_SCORING: Record<number, number> = {
  1: 32, 2: 28, 3: 27, 4: 26, 5: 25, 6: 24, 7: 23, 8: 22,
  9: 20, 10: 17, 11: 16, 12: 15, 13: 14, 14: 13, 15: 12,
  16: 11, 17: 9, 18: 7, 19: 6, 20: 5, 21: 4, 22: 3, 23: 2, 24: 1
};

export const DEFAULT_RELAY_SCORING: Record<number, number> = {
  1: 64, 2: 56, 3: 54, 4: 52, 5: 50, 6: 48, 7: 46, 8: 44
};
