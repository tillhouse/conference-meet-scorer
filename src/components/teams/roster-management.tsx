"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Plus } from "lucide-react";
import { AthletesTable } from "@/components/teams/athletes-table";
import { UploadDialog } from "@/components/teams/upload-dialog";
import { AddAthleteDialog } from "@/components/teams/add-athlete-dialog";

type AthleteWithEvents = {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  isEnabled: boolean;
  eventTimes: {
    id: string;
    time: string;
    isEntered: boolean;
    isRelaySplit: boolean;
    event: {
      id: string;
      name: string;
    };
  }[];
};

interface RosterManagementProps {
  athletes: AthleteWithEvents[];
  teamId: string;
  teamName: string;
  canEdit: boolean;
}

export function RosterManagement({
  athletes,
  teamId,
  teamName,
  canEdit,
}: RosterManagementProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addAthleteDialogOpen, setAddAthleteDialogOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Athletes</CardTitle>
              <CardDescription>Manage your team roster and athlete events</CardDescription>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Data
                </Button>
                <Button onClick={() => setAddAthleteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Athlete
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <AthletesTable athletes={athletes} teamId={teamId} />
        </CardContent>
      </Card>

      {canEdit && (
        <>
          <UploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            teamId={teamId}
            teamName={teamName}
          />
          <AddAthleteDialog
            open={addAthleteDialogOpen}
            onOpenChange={setAddAthleteDialogOpen}
            teamId={teamId}
            teamName={teamName}
          />
        </>
      )}
    </>
  );
}
