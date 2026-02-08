"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CSVUpload } from "@/components/teams/csv-upload";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
}

export function UploadDialog({ open, onOpenChange, teamId, teamName }: UploadDialogProps) {
  const handleUploadSuccess = () => {
    // Close dialog after successful upload (CSVUpload handles refresh)
    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload CSV Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file with athlete data and times for {teamName}. Data will be saved to the
            team database and available for all meets using this team.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CSVUpload teamId={teamId} teamName={teamName} onSuccess={handleUploadSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
