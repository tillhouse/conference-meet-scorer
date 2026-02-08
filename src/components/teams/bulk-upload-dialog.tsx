"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiTeamUpload } from "@/components/teams/multi-team-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Array<{
    id: string;
    name: string;
    schoolName: string | null;
  }>;
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  teams,
}: BulkUploadDialogProps) {
  const handleUploadSuccess = () => {
    // Close dialog after successful upload (MultiTeamUpload handles refresh)
    setTimeout(() => {
      onOpenChange(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file with data for multiple teams at once. Your CSV must include a "Team"
            column that matches team names in your master database.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Teams must already exist in your master database before uploading data. If you see
              errors about teams not being found, add those teams as competitors first using the
              "Add Competitor" button.
            </AlertDescription>
          </Alert>
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Your CSV will be matched against these teams:
            </p>
            <div className="text-xs text-slate-500 space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-slate-50">
              {teams.map((team) => (
                <div key={team.id}>
                  • {team.name}
                  {team.schoolName && ` (${team.schoolName})`}
                </div>
              ))}
            </div>
          </div>
          <MultiTeamUpload teams={teams} onSuccess={handleUploadSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
