import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCog, Building2, Trophy, Target } from "lucide-react";
import Link from "next/link";
import { TeamMembers } from "@/components/teams/team-members";
import { TeamMeets } from "@/components/teams/team-meets";
import { CompetitorRosters } from "@/components/teams/competitor-rosters";
import { RosterManagement } from "@/components/teams/roster-management";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
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

  // Check user's role in this team
  const userMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: id,
        userId: session.user.id,
      },
    },
  });

  const isOwner = team.ownerId === session.user.id;
  const isAdmin = userMember?.role === "admin" || isOwner;
  const canAccess = isOwner || !!userMember;

  if (!canAccess) {
    redirect("/teams");
  }

  const swimmers = team.athletes.filter((a) => !a.isDiver);
  const divers = team.athletes.filter((a) => a.isDiver);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {team.schoolName && (
              <>
                <Building2 className="h-5 w-5 text-slate-400" />
                <span className="text-slate-500">{team.schoolName}</span>
                <span className="text-slate-300">→</span>
              </>
            )}
            <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
          </div>
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
            My Team
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Target className="h-4 w-4 mr-2" />
            My Competitors
          </TabsTrigger>
          <TabsTrigger value="meets">
            <Trophy className="h-4 w-4 mr-2" />
            Meets
          </TabsTrigger>
          <TabsTrigger value="members">
            <UserCog className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="space-y-4">
          <RosterManagement
            athletes={team.athletes}
            teamId={id}
            teamName={team.name}
            canEdit={isAdmin}
          />
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <CompetitorRosters
            teamAccountId={id}
            primaryTeamName={team.name}
            primaryTeamSchoolName={team.schoolName}
            canEdit={isAdmin}
          />
        </TabsContent>

        <TabsContent value="meets" className="space-y-4">
          <TeamMeets teamAccountId={id} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <TeamMembers teamId={id} isOwner={isOwner} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
