import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Trophy } from "lucide-react";
import Link from "next/link";
import { SimulateMeetViewer } from "@/components/meets/simulate-meet-viewer";

export default async function SimulateMeetPage({
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
          team: true,
        },
        orderBy: {
          totalScore: "desc",
        },
      },
      meetLineups: {
        include: {
          athlete: {
            include: {
              team: true,
            },
          },
          event: true,
        },
      },
      relayEntries: {
        include: {
          team: true,
          event: true,
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  const selectedEvents = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const events = await prisma.event.findMany({
    where: {
      id: { in: selectedEvents },
    },
    orderBy: {
      name: "asc",
    },
  });

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/meets/${id}/results`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Simulate Meet - {meet.name}
            </h1>
            <p className="text-slate-600 mt-1">
              Project results based on seed times and view projected team standings
            </p>
          </div>
        </div>
      </div>

      {/* Simulate Meet Viewer */}
      <SimulateMeetViewer
        meet={meet}
        events={events}
        individualScoring={individualScoring}
        relayScoring={relayScoring}
      />
    </div>
  );
}
