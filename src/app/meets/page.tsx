import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMeetOwnerId } from "@/lib/meet-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DuplicateMeetButton } from "@/components/meets/duplicate-meet-button";
import { DeleteMeetButton } from "@/components/meets/delete-meet-button";

export default async function MeetsPage() {
  const session = await getServerSession(authOptions);

  const meets = await prisma.meet.findMany({
    include: {
      meetTeams: {
        include: {
          team: true,
        },
      },
      team: { select: { ownerId: true } },
      teamAccount: { select: { ownerId: true } },
      _count: {
        select: {
          meetTeams: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Meets</h1>
          <p className="text-slate-600 mt-1">
            Manage championship and dual meets
          </p>
        </div>
        <Button asChild>
          <Link href="/meets/new">
            <Plus className="h-4 w-4 mr-2" />
            New Meet
          </Link>
        </Button>
      </div>

      {/* Meets Grid */}
      {meets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No meets yet
            </h3>
            <p className="text-slate-600 text-center mb-6 max-w-md">
              Create your first meet to start scoring conference championships and dual meets.
            </p>
            <Button asChild>
              <Link href="/meets/new">
                <Plus className="h-4 w-4 mr-2" />
                Create First Meet
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meets.map((meet) => (
            <Card key={meet.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">{meet.name}</CardTitle>
                  <Badge variant={meet.status === "completed" ? "default" : "secondary"}>
                    {meet.status}
                  </Badge>
                </div>
                <CardDescription>
                  {meet.meetType === "championship" ? "Championship" : "Dual"} Meet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {meet.date && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(meet.date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {meet.location && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-4 w-4" />
                      <span>{meet.location}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="text-slate-600">
                      {meet._count.meetTeams} team{meet._count.meetTeams !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Button asChild size="sm">
                    <Link href={`/meets/${meet.id}`}>Open</Link>
                  </Button>
                  <DuplicateMeetButton meetId={meet.id} />
                  {session?.user?.id === getMeetOwnerId(meet) && (
                    <DeleteMeetButton meetId={meet.id} meetName={meet.name} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
