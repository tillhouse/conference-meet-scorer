"use client";

import { useRouter } from "next/navigation";
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

interface UnsavedChangesGuardProps {
  checkUnsaved: () => boolean;
  saveAll: () => Promise<void>;
  nextUrl: string;
  children: React.ReactNode;
}

export function UnsavedChangesGuard({
  checkUnsaved,
  saveAll,
  nextUrl,
  children,
}: UnsavedChangesGuardProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    if (checkUnsaved()) {
      setShowDialog(true);
    } else {
      router.push(nextUrl);
    }
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      await saveAll();
      setShowDialog(false);
      router.push(nextUrl);
    } catch (error) {
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
      {children}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save before continuing?
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
