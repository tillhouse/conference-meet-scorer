/**
 * Utilities for building Slack-friendly text tables (monospace, aligned columns)
 * for copy-to-clipboard. Use inside triple-backtick code blocks in Slack.
 */

export type Align = "left" | "right";

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

/**
 * Pad a string to the given width. Left-align pads on the right; right-align pads on the left.
 */
export function pad(s: string, width: number, align: Align = "left"): string {
  const str = String(s);
  if (str.length >= width) return str;
  const spaces = width - str.length;
  return align === "right" ? " ".repeat(spaces) + str : str + " ".repeat(spaces);
}

export interface FormatTableForSlackOptions {
  /** Column headers */
  headers: string[];
  /** Data rows; each row must have same length as headers */
  rows: string[][];
  /** Per-column alignment; default: first left, rest right */
  align?: Align[];
  /** Optional max width per column; cells are truncated with "…" if longer */
  maxColWidths?: number[];
}

/**
 * Build a single table string with aligned columns. Does not wrap in code block;
 * caller can prepend title and wrap in ``` when copying.
 */
export function formatTableForSlack(options: FormatTableForSlackOptions): string {
  const {
    headers,
    rows,
    align,
    maxColWidths = [],
  } = options;

  const n = headers.length;
  const alignments: Align[] = align ?? [
    "left",
    ...Array.from({ length: n - 1 }, () => "right" as const),
  ];

  // Compute effective width per column (max of header + all cells, capped by maxColWidths)
  const raw: string[][] = [headers, ...rows];
  const widths: number[] = [];
  for (let c = 0; c < n; c++) {
    let w = 0;
    for (let r = 0; r < raw.length; r++) {
      const cell = raw[r]![c] ?? "";
      w = Math.max(w, cell.length);
    }
    const maxW = maxColWidths[c] ?? Infinity;
    widths[c] = Math.min(w, maxW);
  }

  const line = (row: string[]) =>
    row
      .map((cell, c) => {
        const width = widths[c] ?? 0;
        const truncated = truncate(cell, width);
        return pad(truncated, width, alignments[c] ?? "right");
      })
      .join("  "); // two spaces between columns for readability

  const lines: string[] = [line(headers), ...rows.map(line)];
  return lines.join("\n");
}

/**
 * Build the full string to copy: optional title, then code block with table.
 * Ready to paste into Slack (user can paste as-is and Slack will render the code block).
 */
export function buildSlackCopyString(table: string, title?: string): string {
  const parts: string[] = [];
  if (title && title.trim()) {
    parts.push(title.trim());
    parts.push("");
  }
  parts.push("```");
  parts.push(table);
  parts.push("```");
  return parts.join("\n");
}
