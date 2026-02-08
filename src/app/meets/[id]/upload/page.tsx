import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { MeetCSVUpload } from "@/components/meets/meet-csv-upload";

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/meets/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Upload Team Data</h1>
          <p className="text-slate-600 mt-1">
            Upload CSV files with athlete times for all teams in {meet.name}
          </p>
        </div>
      </div>

      {/* Upload Component */}
      <MeetCSVUpload meetId={id} meetTeams={meet.meetTeams.map((mt) => mt.team)} />
    </div>
  );
}
