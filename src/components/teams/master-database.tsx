"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Database, Crown, Building2, Upload } from "lucide-react";
import { MultiTeamUpload } from "@/components/teams/multi-team-upload";
import { CompetitorTeams } from "@/components/teams/competitor-teams";
import { CSVUpload } from "@/components/teams/csv-upload";

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  schoolName: string | null;
  primaryColor: string | null;
  ownerId: string;
  _count: {
    athletes: number;
  };
}

interface CompetitorTeam {
  id: string;
  competitorTeam: {
    id: string;
    name: string;
    shortName: string | null;
    schoolName: string | null;
    primaryColor: string | null;
    _count: {
      athletes: number;
    };
  };
}

interface MasterDatabaseProps {
  teamAccountId: string;
  primaryTeam: Team;
  canEdit: boolean;
}

export function MasterDatabase({
  teamAccountId,
  primaryTeam,
  canEdit,
}: MasterDatabaseProps) {
  const [competitors, setCompetitors] = useState<CompetitorTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get("tab") === "competitors" ? "competitors" : "overview";

  useEffect(() => {
    loadCompetitors();
  }, [teamAccountId]);

  const loadCompetitors = async () => {
    try {
      const response = await fetch(`/api/teams/${teamAccountId}/competitors`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to load competitor teams");
      }
      const data = await response.json();
      setCompetitors(data);
    } catch (error) {
      console.error("Error loading competitors:", error);
      // Set empty array on error so UI doesn't break
      setCompetitors([]);
    } finally {
      setLoading(false);
    }
  };

  // Combine primary team and competitor teams for master database
  const allTeams = [
    {
      id: primaryTeam.id,
      name: primaryTeam.name,
      schoolName: primaryTeam.schoolName,
      isPrimary: true,
      athleteCount: primaryTeam._count.athletes,
    },
    ...competitors.map((c) => ({
      id: c.competitorTeam.id,
      name: c.competitorTeam.name,
      schoolName: c.competitorTeam.schoolName,
      isPrimary: false,
      athleteCount: c.competitorTeam._count.athletes,
    })),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Master Database
          </CardTitle>
          <CardDescription>
            Your master database contains your primary team and all competitor teams. Upload data
            for multiple teams at once, or manage teams individually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="upload">Upload Data</TabsTrigger>
              <TabsTrigger value="competitors">Manage Competitors</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Teams in Master Database</h3>
                    <span className="text-sm text-slate-500">
                      {allTeams.length} team{allTeams.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allTeams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          {team.isPrimary ? (
                            <Crown className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <Users className="h-5 w-5 text-slate-400" />
                          )}
                          <div>
                            <div className="font-medium">
                              {team.name}
                              {team.isPrimary && (
                                <span className="text-xs text-slate-500 ml-2">(Your Team)</span>
                              )}
                            </div>
                            {team.schoolName && (
                              <div className="text-sm text-slate-500 flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {team.schoolName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-slate-600">
                          {team.athleteCount} athletes
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <Tabs defaultValue="multi" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="multi">
                    <Upload className="h-4 w-4 mr-2" />
                    Multiple Teams
                  </TabsTrigger>
                  <TabsTrigger value="single">
                    <Users className="h-4 w-4 mr-2" />
                    Single Team
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="multi" className="space-y-4">
                  <MultiTeamUpload
                    teams={allTeams.map((t) => ({
                      id: t.id,
                      name: t.name,
                      schoolName: t.schoolName,
                    }))}
                  />
                </TabsContent>

                <TabsContent value="single" className="space-y-4">
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-slate-50">
                      <h3 className="font-semibold mb-2">Upload Data for a Single Team</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        Select a team from your master database to upload data for that team only.
                        This is useful when you have data for just one team.
                      </p>
                      <div className="space-y-3">
                        {allTeams.map((team) => (
                          <div key={team.id} className="border rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {team.isPrimary ? (
                                  <Crown className="h-5 w-5 text-yellow-500" />
                                ) : (
                                  <Users className="h-5 w-5 text-slate-400" />
                                )}
                                <div>
                                  <div className="font-medium">
                                    {team.name}
                                    {team.isPrimary && (
                                      <span className="text-xs text-slate-500 ml-2">
                                        (Your Team)
                                      </span>
                                    )}
                                  </div>
                                  {team.schoolName && (
                                    <div className="text-sm text-slate-500 flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {team.schoolName}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-slate-600">
                                {team.athleteCount} athletes
                              </div>
                            </div>
                            <CSVUpload teamId={team.id} teamName={team.name} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="competitors" className="space-y-4">
              <CompetitorTeams teamAccountId={teamAccountId} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
