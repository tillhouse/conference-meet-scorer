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
  simulated: "Simulated (seed times)",
  real: "Real results",
  hybrid: "Hybrid (real + simulated)",
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

  const handleChange = (newView: ViewMode) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("view", newView);
    router.push(`${pathname ?? ""}?${next.toString()}`);
  };

  return (
    <Select value={value} onValueChange={(v) => handleChange(v as ViewMode)}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Results view" />
      </SelectTrigger>
      <SelectContent className="max-h-[12rem]" side="bottom" avoidCollisions={false}>
        <SelectItem value="simulated">{VIEW_LABELS.simulated}</SelectItem>
        <SelectItem value="real">{VIEW_LABELS.real}</SelectItem>
        <SelectItem value="hybrid">{VIEW_LABELS.hybrid}</SelectItem>
      </SelectContent>
    </Select>
  );
}
