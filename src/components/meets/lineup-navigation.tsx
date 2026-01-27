"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";

interface LineupNavigationProps {
  meetId: string;
  teamIds: string[];
  backUrl: string;
  nextUrl: string;
}

export function LineupNavigation({
  meetId,
  teamIds,
  backUrl,
  nextUrl,
}: LineupNavigationProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const checkUnsavedChanges = () => {
    return teamIds.some((teamId) => {
      const selector = (window as any)[`lineupSelector_${teamId}`];
      return selector?.hasUnsavedChanges || false;
    });
  };

  const saveAll = async () => {
    for (const teamId of teamIds) {
      const selector = (window as any)[`lineupSelector_${teamId}`];
      if (selector?.hasUnsavedChanges && selector?.save) {
        try {
          await selector.save();
        } catch (error) {
          console.error(`Failed to save lineups for team ${teamId}:`, error);
          throw error;
        }
      }
    }
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (checkUnsavedChanges()) {
      setShowDialog(true);
    } else {
      router.push(nextUrl);
    }
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      await saveAll();
      toast.success("All lineups saved successfully");
      setShowDialog(false);
      router.push(nextUrl);
    } catch (error) {
      toast.error("Failed to save lineups. Please try again.");
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleContinueWithoutSaving = () => {
    setShowDialog(false);
    router.push(nextUrl);
  };

  return (
    <>
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" asChild>
          <Link href={backUrl}>Back</Link>
        </Button>
        <Button onClick={handleNext}>Next: Set Relays</Button>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your lineups. Would you like to save before continuing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleContinueWithoutSaving}>
              Continue Without Saving
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndContinue} disabled={saving}>
              {saving ? "Saving..." : "Save and Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
