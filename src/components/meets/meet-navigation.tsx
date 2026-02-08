"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Users, 
  ListChecks, 
  UsersRound, 
  LayoutDashboard,
  BarChart3,
  UserCheck,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetNavigationProps {
  meetId: string;
  status: string;
}

export function MeetNavigation({ meetId, status }: MeetNavigationProps) {
  const pathname = usePathname();

  const setupActions = [
    {
      href: `/meets/${meetId}/edit`,
      label: "Edit Meet",
      icon: Settings,
      alwaysVisible: true,
    },
    {
      href: `/meets/${meetId}/upload`,
      label: "Upload Data",
      icon: Upload,
      alwaysVisible: false,
    },
    {
      href: `/meets/${meetId}/roster`,
      label: "Set Rosters",
      icon: Users,
      alwaysVisible: false,
    },
    {
      href: `/meets/${meetId}/lineups`,
      label: "Set Lineups",
      icon: ListChecks,
      alwaysVisible: false,
    },
    {
      href: `/meets/${meetId}/relays`,
      label: "Create Relays",
      icon: UsersRound,
      alwaysVisible: false,
    },
  ];

  const viewNavItems = [
    {
      href: `/meets/${meetId}`,
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      href: `/meets/${meetId}/athletes`,
      label: "Athlete Summary",
      icon: UserCheck,
    },
    {
      href: `/meets/${meetId}/events`,
      label: "Event Results",
      icon: BarChart3,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/meets/${meetId}`) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="space-y-4">
      {/* Setup Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-500 mr-2">Setup:</span>
        {setupActions.map((action) => {
          if (!action.alwaysVisible && status !== "draft") return null;
          const Icon = action.icon;
          return (
            <Button
              key={action.href}
              variant="outline"
              size="sm"
              asChild
              className={cn(
                "transition-colors",
                isActive(action.href) && "bg-slate-100 border-slate-300"
              )}
            >
              <Link href={action.href}>
                <Icon className="h-4 w-4 mr-2" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {/* View Navigation */}
      <div className="flex items-center gap-2 flex-wrap border-t pt-4">
        <span className="text-sm font-medium text-slate-500 mr-2">View:</span>
        {viewNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              variant={isActive(item.href) ? "default" : "ghost"}
              size="sm"
              asChild
              className="transition-colors"
            >
              <Link href={item.href}>
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
