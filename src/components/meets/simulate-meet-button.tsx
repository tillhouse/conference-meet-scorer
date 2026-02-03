"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SimulateMeetButtonProps {
  meetId: string;
  hasResults: boolean;
}

export function SimulateMeetButton({ meetId, hasResults }: SimulateMeetButtonProps) {
  const router = useRouter();
  const [isSimulating, setIsSimulating] = useState(false);
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

  return (
    <div className="flex items-center gap-2">
      {simulated && (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      )}
      <Button onClick={handleSimulate} disabled={isSimulating} size="sm">
        <Play className="h-4 w-4 mr-2" />
        {isSimulating ? "Simulating..." : hasResults ? "Re-simulate" : "Simulate Meet"}
      </Button>
    </div>
  );
}
