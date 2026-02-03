"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SimulateMeetCardProps {
  meetId: string;
  hasResults: boolean;
}

export function SimulateMeetCard({ meetId, hasResults }: SimulateMeetCardProps) {
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
    <Card className={hasResults ? "" : "border-2"}>
      <CardHeader>
        <CardTitle>Run Meet Simulation</CardTitle>
        <CardDescription>
          {hasResults 
            ? "Meet has been simulated. View results below or re-simulate with updated data."
            : "Simulate the meet results based on seed times. This will assign places and calculate points automatically."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {simulated ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-600 font-medium">
                  Meet has been simulated
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="text-sm text-amber-600">
                  No simulation has been run yet
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSimulate} disabled={isSimulating} size={hasResults ? "default" : "lg"}>
              <Play className="h-4 w-4 mr-2" />
              {isSimulating ? "Simulating..." : hasResults ? "Re-simulate" : "Simulate Meet"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
