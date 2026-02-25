"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DeleteMeetButtonProps {
  meetId: string;
  meetName: string;
}

export function DeleteMeetButton({ meetId, meetName }: DeleteMeetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next && !isDeleting) {
      setConfirmValue("");
    }
    setOpen(next);
  };

  const handleDelete = async () => {
    if (confirmValue !== "DELETE") return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete meet");
      }

      toast.success("Meet deleted");
      setOpen(false);
      router.push("/meets");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete meet");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete meet?</DialogTitle>
            <DialogDescription>
              This will permanently delete the meet and all its data (lineups, results, standings).
              This action cannot be undone.
              {meetName && (
                <span className="mt-2 block font-medium text-foreground">
                  Meet: {meetName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-meet-confirm">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-meet-confirm"
              type="text"
              placeholder="DELETE"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              disabled={isDeleting}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmValue !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {isDeleting ? "Deleting..." : "Delete meet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
