"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update scoring mode");
    }
  };

  const labels: Record<ScoringMode, string> = {
    simulated: "Projected",
    real: "Actual",
    hybrid: "Combined",
  };

  return (
    <Select value={mode} onValueChange={(v) => handleChange(v as ScoringMode)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue>{labels[mode]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="simulated">
          <div>
            <div>Projected</div>
            <div className="text-xs text-muted-foreground font-normal">
              Based on athletes&apos; seed times
            </div>
          </div>
        </SelectItem>
        <SelectItem value="real">
          <div>
            <div>Actual</div>
            <div className="text-xs text-muted-foreground font-normal">
              Scored from officially entered results
            </div>
          </div>
        </SelectItem>
        <SelectItem value="hybrid">
          <div>
            <div>Combined</div>
            <div className="text-xs text-muted-foreground font-normal">
              Actual where available, projected otherwise
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
