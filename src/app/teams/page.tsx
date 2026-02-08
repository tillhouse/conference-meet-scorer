import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Building2, Crown } from "lucide-react";
import { redirect } from "next/navigation";
import { MultiTeamUpload } from "@/components/teams/multi-team-upload";

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  try {
    // Get only teams the user OWNS (these are Team Accounts)
    // Teams where user is a member (but not owner) are shown separately
    const ownedTeams = await prisma.team.findMany({
      where: {
        ownerId: session.user.id,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            athletes: true,
            members: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // For each Team Account, get its competitor teams
    const teamsWithCompetitors = await Promise.all(
      ownedTeams.map(async (team) => {
        const competitors = await prisma.teamCompetitor.findMany({
          where: {
            teamAccountId: team.id,
          },
          include: {
            competitorTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                schoolName: true,
                primaryColor: true,
                _count: {
                  select: {
                    athletes: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
        return {
          ...team,
          competitors: competitors.map((c) => c.competitorTeam),
        };
      })
    );

    // Get teams where user is a member (but not owner) - these are Team Accounts they collaborate on
    const memberTeams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
        ownerId: {
          not: session.user.id, // Exclude teams they own (already in ownedTeams)
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            athletes: true,
            members: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Group teams by school
    const teamsBySchool = teamsWithCompetitors.reduce((acc, team) => {
      const school = team.schoolName || "Other";
      if (!acc[school]) {
        acc[school] = [];
      }
      acc[school].push(team);
      return acc;
    }, {} as Record<string, typeof teamsWithCompetitors>);

    // Determine if user has a Team Account
    const hasTeamAccount = ownedTeams.length > 0;
    const primaryTeamAccount = ownedTeams[0]; // First Team Account

    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Team Accounts</h1>
            <p className="text-slate-600 mt-1">
              Manage your team accounts, master databases, and meets
            </p>
          </div>
          {hasTeamAccount ? (
            <Button asChild>
              <Link href={`/teams/${primaryTeamAccount.id}?tab=competitors`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Competitor Team
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/teams/new">
                <Plus className="h-4 w-4 mr-2" />
                New Team Account
              </Link>
            </Button>
          )}
        </div>


        {/* Teams by School */}
        {teamsWithCompetitors.length === 0 && memberTeams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No team accounts yet
              </h3>
              <p className="text-slate-600 text-center mb-6 max-w-md">
                Create your first team account to start managing your master database, rosters, and meets.
              </p>
              <Button asChild>
                <Link href="/teams/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Team
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Owned Teams (Team Accounts) with Competitor Teams */}
            {teamsWithCompetitors.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">My Team Accounts</h2>
                {Object.entries(teamsBySchool).map(([school, schoolTeams]) => (
                  <div key={school} className="space-y-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-slate-500" />
                      <h3 className="text-xl font-semibold text-slate-900">
                        {school}
                      </h3>
                    </div>
                    {schoolTeams.map((team) => (
                      <div key={team.id} className="space-y-3">
                        {/* Primary Team Account Card */}
                        <Card className="hover:shadow-lg transition-shadow border-2 border-blue-200">
                          <Link href={`/teams/${team.id}`}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-xl">{team.name}</CardTitle>
                                  <Crown className="h-4 w-4 text-yellow-500" title="Your Team Account" />
                                </div>
                                {team.primaryColor && (
                                  <div
                                    className="h-4 w-4 rounded-full"
                                    style={{ backgroundColor: team.primaryColor }}
                                  />
                                )}
                              </div>
                              {team.shortName && (
                                <CardDescription>{team.shortName}</CardDescription>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  <span className="text-slate-600">
                                    {team._count.athletes} athletes
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  <span className="text-slate-600">
                                    {team._count.members} members
                                  </span>
                                </div>
                                {team.competitors.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    <span className="text-slate-600">
                                      {team.competitors.length} competitor{team.competitors.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Link>
                        </Card>

                        {/* Competitor Teams (nested under Team Account) */}
                        {team.competitors.length > 0 && (
                          <div className="ml-6 space-y-2 border-l-2 border-slate-200 pl-4">
                            <p className="text-sm font-medium text-slate-600 mb-2">
                              Competitor Teams in Master Database:
                            </p>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {team.competitors.map((competitor) => (
                                <Card key={competitor.id} className="hover:shadow-md transition-shadow bg-slate-50">
                                  <Link href={`/teams/${team.id}?view=competitor&id=${competitor.id}`}>
                                    <CardHeader className="pb-3">
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{competitor.name}</CardTitle>
                                        {competitor.primaryColor && (
                                          <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: competitor.primaryColor }}
                                          />
                                        )}
                                      </div>
                                      {competitor.shortName && (
                                        <CardDescription className="text-xs">{competitor.shortName}</CardDescription>
                                      )}
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                      <div className="flex items-center gap-2 text-xs">
                                        <Users className="h-3 w-3 text-slate-400" />
                                        <span className="text-slate-600">
                                          {competitor._count.athletes} athletes
                                        </span>
                                      </div>
                                    </CardContent>
                                  </Link>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Member Teams (Collaborations) */}
            {memberTeams.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">Collaborations</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {memberTeams.map((team) => (
                    <Card key={team.id} className="hover:shadow-lg transition-shadow">
                      <Link href={`/teams/${team.id}`}>
                        <CardHeader>
                          <CardTitle className="text-xl">{team.name}</CardTitle>
                          {team.shortName && (
                            <CardDescription>{team.shortName}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-600">
                                {team._count.athletes} athletes
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-600">
                                {team._count.members} members
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error loading teams:", error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Teams</h1>
          <p className="text-slate-600 mt-1">
            Manage team rosters and athlete data
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold text-red-600 mb-2">
              Error loading teams
            </h3>
            <p className="text-slate-600 text-center mb-4">
              {error instanceof Error ? error.message : "An unknown error occurred"}
            </p>
            <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto max-w-2xl">
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }
}
