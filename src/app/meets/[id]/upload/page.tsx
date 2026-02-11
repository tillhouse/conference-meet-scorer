import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { MeetCSVUpload } from "@/components/meets/meet-csv-upload";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";

export default async function MeetUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetTeams: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              schoolName: true,
            },
          },
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Upload Team Data</h1>
            <p className="text-slate-600 mt-1">
              Upload CSV files with athlete times for all teams in {meet.name}
            </p>
          </div>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Upload Component */}
      <MeetCSVUpload meetId={id} meetTeams={meet.meetTeams.map((mt) => mt.team)} />
    </div>
  );
}
