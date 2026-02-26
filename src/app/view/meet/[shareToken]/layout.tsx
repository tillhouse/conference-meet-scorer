import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PublicMeetNavigation } from "@/components/meets/public-meet-navigation";
import { PublicViewModeSelector } from "@/components/meets/public-view-mode-selector";

export default async function ViewMeetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const meet = await prisma.meet.findUnique({
    where: { shareToken },
    select: { id: true, name: true },
  });

  if (!meet || !meet.name) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{meet.name}</h1>
            <Badge variant="secondary" className="mt-1">
              View only
            </Badge>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <PublicMeetNavigation shareToken={shareToken} />
            <PublicViewModeSelector />
          </div>
        </div>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
