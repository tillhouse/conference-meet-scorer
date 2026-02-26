"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ViewMode = "simulated" | "real" | "hybrid";

const VIEW_LABELS: Record<ViewMode, string> = {
  simulated: "Projected",
  real: "Actual",
  hybrid: "Combined",
};

const VALID_VIEWS: ViewMode[] = ["simulated", "real", "hybrid"];

function parseView(param: string | null): ViewMode {
  if (param && VALID_VIEWS.includes(param as ViewMode)) return param as ViewMode;
  return "simulated";
}

export function PublicViewModeSelector() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const value = parseView(searchParams?.get("view"));
  const labelForTrigger = VIEW_LABELS[value];

  const handleChange = (newView: ViewMode) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("view", newView);
    router.push(`${pathname ?? ""}?${next.toString()}`);
  };

  return (
    <Select value={value} onValueChange={(v) => handleChange(v as ViewMode)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Results view">{labelForTrigger}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[12rem]" side="bottom" avoidCollisions={false}>
        <SelectItem value="simulated">
          <div>
            <div>Projected</div>
            <div className="text-xs text-muted-foreground font-normal">
              Based on athletes&apos; seed times
            </div>
          </div>
        </SelectItem>
        <SelectItem value="real">
          <div>
            <div>Actual</div>
            <div className="text-xs text-muted-foreground font-normal">
              Scored from officially entered results
            </div>
          </div>
        </SelectItem>
        <SelectItem value="hybrid">
          <div>
            <div>Combined</div>
            <div className="text-xs text-muted-foreground font-normal">
              Actual where available, projected otherwise
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
