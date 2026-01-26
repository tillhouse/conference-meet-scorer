import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default async function TeamsPage() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: {
          select: {
            athletes: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Teams</h1>
            <p className="text-slate-600 mt-1">
              Manage team rosters and athlete data
            </p>
          </div>
          <Button asChild>
            <Link href="/teams/new">
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Link>
          </Button>
        </div>

        {/* Teams Grid */}
        {teams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No teams yet
              </h3>
              <p className="text-slate-600 text-center mb-6 max-w-md">
                Create your first team to start managing rosters and uploading athlete data.
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card key={team.id} className="hover:shadow-lg transition-shadow">
                <Link href={`/teams/${team.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{team.name}</CardTitle>
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
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
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
