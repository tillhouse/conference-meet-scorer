"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BarChart3,
  UserCheck,
  Beaker,
} from "lucide-react";

interface PublicMeetNavigationProps {
  shareToken: string;
}

const base = (shareToken: string) => `/view/meet/${shareToken}`;

function hrefWithView(href: string, view: string | null): string {
  if (!view) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}view=${encodeURIComponent(view)}`;
}

export function PublicMeetNavigation({ shareToken }: PublicMeetNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams?.get("view");

  const viewNavItems = [
    { href: base(shareToken), label: "Overview", icon: LayoutDashboard },
    { href: `${base(shareToken)}/athletes`, label: "Athlete Summary", icon: UserCheck },
    { href: `${base(shareToken)}/events`, label: "Event Results", icon: BarChart3 },
    { href: `${base(shareToken)}/analysis`, label: "Analysis Results", icon: Beaker },
  ];

  const isActive = (href: string) => {
    if (href === base(shareToken)) {
      return pathname === href || pathname === href + (pathname?.includes("?") ? "" : "");
    }
    return pathname?.startsWith(href.split("?")[0] ?? href);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-500 mr-2">View:</span>
      {viewNavItems.map((item) => {
        const Icon = item.icon;
        const href = hrefWithView(item.href, view);
        return (
          <Button
            key={item.href}
            variant={isActive(item.href) ? "default" : "ghost"}
            size="sm"
            asChild
            className="transition-colors"
          >
            <Link href={href}>
              <Icon className="h-4 w-4 mr-2" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
