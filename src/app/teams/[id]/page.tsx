import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Users, Plus, Edit } from "lucide-react";
import Link from "next/link";
import { AthletesTable } from "@/components/teams/athletes-table";
import { CSVUpload } from "@/components/teams/csv-upload";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      athletes: {
        include: {
          eventTimes: {
            include: {
              event: true,
            },
          },
        },
        orderBy: [
          { lastName: "asc" },
          { firstName: "asc" },
        ],
      },
      _count: {
        select: {
          athletes: true,
        },
      },
    },
  });

  if (!team) {
    notFound();
  }

  const swimmers = team.athletes.filter((a) => !a.isDiver);
  const divers = team.athletes.filter((a) => a.isDiver);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
          <p className="text-slate-600 mt-1">
            {team._count.athletes} athletes • {swimmers.length} swimmers • {divers.length} divers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/teams">
              Back to Teams
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roster" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roster">
            <Users className="h-4 w-4 mr-2" />
            Roster
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Athletes</CardTitle>
                  <CardDescription>
                    Manage your team roster and athlete events
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link href={`/teams/${id}/athletes/new`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Athlete
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <AthletesTable athletes={team.athletes} teamId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <CSVUpload teamId={id} teamName={team.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
