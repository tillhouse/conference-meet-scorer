"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type ScoringMode = "simulated" | "real" | "hybrid";

interface ScoringModeSelectorProps {
  meetId: string;
  value: string | null | undefined;
}

export function ScoringModeSelector({ meetId, value }: ScoringModeSelectorProps) {
  const [mode, setMode] = useState<ScoringMode>((value as ScoringMode) || "simulated");

  const handleChange = async (newMode: ScoringMode) => {
    try {
      const res = await fetch(`/api/meets/${meetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoringMode: newMode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      setMode(newMode);
      toast.success("Scoring mode updated");
      window.dispatchEvent(new Event("meet-scoring-mode-updated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update scoring mode");
    }
  };

  return (
    <Select value={mode} onValueChange={(v) => handleChange(v as ScoringMode)}>
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="Scoring mode" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="simulated">Simulate from seed times</SelectItem>
        <SelectItem value="real">Score real results</SelectItem>
        <SelectItem value="hybrid">Hybrid (real + simulated)</SelectItem>
      </SelectContent>
    </Select>
  );
}
