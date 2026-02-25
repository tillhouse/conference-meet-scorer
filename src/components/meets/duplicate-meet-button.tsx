"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DuplicateMeetButtonProps {
  meetId: string;
}

export function DuplicateMeetButton({ meetId }: DuplicateMeetButtonProps) {
  const router = useRouter();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/clone`, {
        method: "POST",
      });

      const payload = await response.json().catch(() => ({} as { error?: string; id?: string }));
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "Failed to duplicate meet");
      }

      toast.success("Meet duplicated");
      router.push(`/meets/${payload.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate meet");
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isDuplicating}
      onClick={handleDuplicate}
    >
      {isDuplicating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {isDuplicating ? "Duplicating..." : "Duplicate"}
    </Button>
  );
}
