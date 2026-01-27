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

interface RelayNavigationProps {
  meetId: string;
  teamIds: string[];
  backUrl: string;
  nextUrl: string;
}

export function RelayNavigation({
  meetId,
  teamIds,
  backUrl,
  nextUrl,
}: RelayNavigationProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const checkUnsavedChanges = () => {
    return teamIds.some((teamId) => {
      const creator = (window as any)[`relayCreator_${teamId}`];
      return creator?.hasUnsavedChanges || false;
    });
  };

  const saveAll = async () => {
    for (const teamId of teamIds) {
      const creator = (window as any)[`relayCreator_${teamId}`];
      if (creator?.hasUnsavedChanges && creator?.save) {
        try {
          await creator.save();
        } catch (error) {
          console.error(`Failed to save relays for team ${teamId}:`, error);
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
      toast.success("All relays saved successfully");
      setShowDialog(false);
      router.push(nextUrl);
    } catch (error) {
      toast.error("Failed to save relays. Please try again.");
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
        <Button onClick={handleNext}>View Results & Standings</Button>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your relays. Would you like to save before continuing?
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
