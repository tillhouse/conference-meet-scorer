"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SimulateMeetButtonProps {
  meetId: string;
  hasResults: boolean;
  scoringMode?: string | null;
}

export function SimulateMeetButton({ meetId, hasResults, scoringMode }: SimulateMeetButtonProps) {
  const isHybrid = scoringMode === "hybrid";
  const label = isHybrid
    ? (hasResults ? "Re-score meet (real + simulated)" : "Score meet (real + simulated)")
    : (hasResults ? "Re-simulate" : "Simulate Meet");
  const title = isHybrid
    ? "Score meet: use real results where entered, simulate the rest"
    : undefined;
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [simulated, setSimulated] = useState(hasResults);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to simulate meet");
      }

      toast.success("Meet simulated successfully!");
      setSimulated(true);
      // Refresh the page to get updated data
      router.refresh();
    } catch (error: any) {
      console.error("Error simulating meet:", error);
      toast.error(error.message || "Failed to simulate meet");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/backfill-seedtimes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to backfill seed times");
      }

      const data = await response.json();
      toast.success(`Backfill completed: ${data.updated} times updated, ${data.skipped} skipped`);
      
      // Refresh the page to get updated data
      router.refresh();
    } catch (error: any) {
      console.error("Error backfilling seed times:", error);
      toast.error(error.message || "Failed to backfill seed times");
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {simulated && (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      )}
      <Button 
        onClick={handleBackfill} 
        disabled={isBackfilling || isSimulating} 
        variant="outline"
        size="sm"
        title="Fill in missing seed times for existing lineups"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        {isBackfilling ? "Filling Times..." : "Fill Missing Times"}
      </Button>
      <Button onClick={handleSimulate} disabled={isSimulating || isBackfilling} size="sm" title={title}>
        <Play className="h-4 w-4 mr-2" />
        {isSimulating ? "Simulating..." : label}
      </Button>
    </div>
  );
}
