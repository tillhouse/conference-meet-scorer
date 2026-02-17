"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Users, Beaker, BarChart2 } from "lucide-react";
import { formatName, formatTeamName } from "@/lib/utils";
import { toast } from "sonner";

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  eventTimes: {
    id: string;
    event: {
      id: string;
      name: string;
    };
  }[];
}

interface Team {
  id: string;
  name: string;
  schoolName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  athletes: Athlete[];
}

interface MeetTeam {
  id: string;
  teamId: string;
}

interface RosterSelectorProps {
  meetId: string;
  meetTeam: MeetTeam;
  team: Team;
  maxAthletes: number;
  diverRatio: number;
  divingIncluded: boolean;
}

export function RosterSelector({
  meetId,
  meetTeam,
  team,
  maxAthletes,
  diverRatio,
  divingIncluded,
}: RosterSelectorProps) {
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [includeTestSpot, setIncludeTestSpot] = useState(false);
  const [testSpotAthleteIds, setTestSpotAthleteIds] = useState<string[]>([]);
  const [testSpotScoringAthleteId, setTestSpotScoringAthleteId] = useState<string | null>(null);
  const [includeSensitivity, setIncludeSensitivity] = useState(false);
  const [sensitivityAthleteId, setSensitivityAthleteId] = useState<string | null>(null);
  const [sensitivityPercent, setSensitivityPercent] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing roster selections
  useEffect(() => {
    fetch(`/api/meets/${meetId}/rosters/${meetTeam.teamId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.athleteIds) {
          setSelectedAthletes(new Set(data.athleteIds));
        }
        if (data.testSpotAthleteIds?.length) {
          setIncludeTestSpot(true);
          setTestSpotAthleteIds(data.testSpotAthleteIds);
          setTestSpotScoringAthleteId(
            data.testSpotScoringAthleteId && data.testSpotAthleteIds.includes(data.testSpotScoringAthleteId)
              ? data.testSpotScoringAthleteId
              : data.testSpotAthleteIds[0]
          );
        } else {
          setIncludeTestSpot(false);
          setTestSpotAthleteIds([]);
          setTestSpotScoringAthleteId(null);
        }
        if (data.sensitivityAthleteId) {
          setIncludeSensitivity(true);
          setSensitivityAthleteId(data.sensitivityAthleteId);
          setSensitivityPercent(typeof data.sensitivityPercent === "number" ? data.sensitivityPercent : 1);
        } else {
          setIncludeSensitivity(false);
          setSensitivityAthleteId(null);
          setSensitivityPercent(1);
        }
      })
      .catch(() => {
        // No existing roster, that's fine
      });
  }, [meetId, meetTeam.teamId]);

  // Filter athletes based on diving inclusion
  const availableAthletes = team.athletes.filter(
    (athlete) => divingIncluded || !athlete.isDiver
  );

  // Calculate current roster count (swimmers + divers × ratio)
  const calculateRosterCount = (selected: Set<string>) => {
    let swimmers = 0;
    let divers = 0;

    selected.forEach((athleteId) => {
      const athlete = availableAthletes.find((a) => a.id === athleteId);
      if (athlete) {
        if (athlete.isDiver) {
          divers++;
        } else {
          swimmers++;
        }
      }
    });

    return swimmers + divers * diverRatio;
  };

  // Scoring roster = everyone except test-spot candidates, plus the one scoring test-spot athlete
  const scoringAthleteIds = Array.from(selectedAthletes).filter(
    (id) => !testSpotAthleteIds.includes(id) || id === testSpotScoringAthleteId
  );
  const scoringCount = calculateRosterCount(new Set(scoringAthleteIds));
  const isValid = scoringCount <= maxAthletes;
  const remaining = maxAthletes - scoringCount;
  const hasTestSpot = testSpotAthleteIds.length > 0;

  const handleToggleAthlete = (athleteId: string) => {
    const newSelected = new Set(selectedAthletes);
    let newTestSpot = [...testSpotAthleteIds];
    let newScorer = testSpotScoringAthleteId;

    if (newSelected.has(athleteId)) {
      newSelected.delete(athleteId);
      if (testSpotAthleteIds.includes(athleteId)) {
        newTestSpot = newTestSpot.filter((id) => id !== athleteId);
        if (testSpotScoringAthleteId === athleteId) {
          newScorer = newTestSpot.length > 0 ? newTestSpot[0] : null;
        }
      }
    } else {
      newSelected.add(athleteId);
      if (!includeTestSpot) {
        const wouldBeCount = calculateRosterCount(newSelected);
        if (wouldBeCount > maxAthletes) {
          toast.error(`Adding this athlete would exceed the ${maxAthletes} athlete limit`);
          return;
        }
      } else {
        const wouldBeScoringCount = calculateRosterCount(
          new Set(
            Array.from(newSelected).filter((id) => !newTestSpot.includes(id) || id === newScorer)
          )
        );
        if (wouldBeScoringCount > maxAthletes) {
          if (!newTestSpot.includes(athleteId)) {
            newTestSpot.push(athleteId);
            newScorer = newScorer && newTestSpot.includes(newScorer) ? newScorer : athleteId;
          }
        }
      }
    }

    setSelectedAthletes(newSelected);
    setTestSpotAthleteIds(newTestSpot);
    setTestSpotScoringAthleteId(newScorer);
  };

  const handleIncludeTestSpotChange = (checked: boolean) => {
    setIncludeTestSpot(checked);
    if (!checked) {
      setTestSpotAthleteIds([]);
      setTestSpotScoringAthleteId(null);
      const totalCount = calculateRosterCount(selectedAthletes);
      if (totalCount > maxAthletes) {
        toast.info("Remove athletes or re-enable test spot and assign them to stay within limit.");
      }
    }
  };

  const handleToggleTestSpot = (athleteId: string) => {
    const newTestSpot = testSpotAthleteIds.includes(athleteId)
      ? testSpotAthleteIds.filter((id) => id !== athleteId)
      : [...testSpotAthleteIds, athleteId];
    let newScorer = testSpotScoringAthleteId;
    if (testSpotScoringAthleteId === athleteId && newTestSpot.length > 0 && !newTestSpot.includes(athleteId)) {
      newScorer = newTestSpot[0];
    }
    if (newTestSpot.length > 0 && (!newScorer || !newTestSpot.includes(newScorer))) {
      newScorer = newTestSpot[0];
    }
    if (newTestSpot.length === 0) newScorer = null;
    setTestSpotAthleteIds(newTestSpot);
    setTestSpotScoringAthleteId(newScorer);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: {
        athleteIds: string[];
        testSpotAthleteIds?: string[];
        testSpotScoringAthleteId?: string | null;
        sensitivityAthleteId?: string | null;
        sensitivityPercent?: number;
      } = { athleteIds: Array.from(selectedAthletes) };
      if (includeTestSpot && testSpotAthleteIds.length > 0 && testSpotScoringAthleteId) {
        body.testSpotAthleteIds = testSpotAthleteIds;
        body.testSpotScoringAthleteId = testSpotScoringAthleteId;
      }
      if (includeSensitivity && sensitivityAthleteId && selectedAthletes.has(sensitivityAthleteId)) {
        body.sensitivityAthleteId = sensitivityAthleteId;
        body.sensitivityPercent = sensitivityPercent;
      } else {
        body.sensitivityAthleteId = null;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/426f4955-f215-4c12-ba39-c5cdc5ffe243',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roster-selector.tsx:before-fetch',message:'Roster save payload',data:{bodyKeys:Object.keys(body),sensitivityAthleteId:body.sensitivityAthleteId,sensitivityPercent:body.sensitivityPercent},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/meets/${meetId}/rosters/${meetTeam.teamId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/426f4955-f215-4c12-ba39-c5cdc5ffe243',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roster-selector.tsx:error-response',message:'Roster save error',data:{errorMsg:error.error,detailsType:typeof error.details,detailsIsArray:Array.isArray(error.details),detailsLength:error.details?.length,firstIssue:error.details?.[0]},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        const detailsStr = Array.isArray(error.details) && error.details.length > 0
          ? error.details.map((d: { message?: string }) => d.message).filter(Boolean).join("; ")
          : (typeof error.details === "string" ? error.details : "");
        const errorDetails = detailsStr ? `: ${detailsStr}` : "";
        throw new Error((error.error || "Failed to save roster") + errorDetails);
      }

      toast.success(`${formatTeamName(team.name, team.schoolName)} roster saved successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  const handleScoringAthleteChange = async (newScoringId: string) => {
    setTestSpotScoringAthleteId(newScoringId);
    try {
      const res = await fetch(
        `/api/meets/${meetId}/rosters/${meetTeam.teamId}/scoring-athlete`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scoringAthleteId: newScoringId }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update scoring athlete");
      }
      toast.success("Scoring athlete updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
      setTestSpotScoringAthleteId(testSpotScoringAthleteId);
    }
  };

  const swimmers = availableAthletes.filter((a) => !a.isDiver);
  const divers = availableAthletes.filter((a) => a.isDiver);

  const displayName = formatTeamName(team.name, team.schoolName);
  const accentStyle = team.primaryColor
    ? { borderLeftColor: team.primaryColor, color: team.primaryColor }
    : undefined;

  return (
    <Card className={team.primaryColor ? "border-l-4" : ""} style={team.primaryColor ? { borderLeftColor: team.primaryColor } : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle style={accentStyle}>{displayName}</CardTitle>
            <CardDescription>
              Select up to {maxAthletes} athletes (divers count as {diverRatio} of a swimmer).
              Optionally use a test spot to compare multiple athletes for one slot.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {hasTestSpot
                  ? `${scoringCount.toFixed(2)} scoring + ${testSpotAthleteIds.length} test`
                  : `Valid (${scoringCount.toFixed(2)}/${maxAthletes})`}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Over Limit ({scoringCount.toFixed(2)}/{maxAthletes})
              </Badge>
            )}
            <Button onClick={handleSave} disabled={!isValid || saving} size="sm">
              {saving ? "Saving..." : "Save Roster"}
            </Button>
          </div>
        </div>
        {includeTestSpot && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200">
            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Test spot: one roster slot. Assign athletes below who are competing for that slot; only one counts toward the team score.
            </p>
            {selectedAthletes.size > maxAthletes && (
              <p className="text-xs text-amber-800 mt-1">
                You have {selectedAthletes.size} selected. Add at least{" "}
                {Math.max(2, selectedAthletes.size - maxAthletes + 1)} to the test spot below to stay within {maxAthletes} scoring.
              </p>
            )}
            {testSpotAthleteIds.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <Label className="text-sm text-amber-900">Scoring athlete:</Label>
                <Select
                  value={testSpotScoringAthleteId ?? ""}
                  onValueChange={handleScoringAthleteChange}
                >
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder="Choose who counts" />
                  </SelectTrigger>
                  <SelectContent>
                    {testSpotAthleteIds.map((id) => {
                      const a = availableAthletes.find((x) => x.id === id);
                      return (
                        <SelectItem key={id} value={id}>
                          {a ? formatName(a.firstName, a.lastName) : id}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Include test spot checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-test-spot"
            checked={includeTestSpot}
            onCheckedChange={(c) => handleIncludeTestSpotChange(c === true)}
          />
          <Label
            htmlFor="include-test-spot"
            className="text-sm font-medium cursor-pointer"
          >
            Include a test spot (compare multiple athletes for one roster slot)
          </Label>
        </div>

        {/* Sensitivity analysis checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-sensitivity"
            checked={includeSensitivity}
            onCheckedChange={(c) => {
              const checked = c === true;
              setIncludeSensitivity(checked);
              if (!checked) {
                setSensitivityAthleteId(null);
                setSensitivityPercent(1);
              }
            }}
          />
          <Label
            htmlFor="include-sensitivity"
            className="text-sm font-medium cursor-pointer"
          >
            Sensitivity analysis (vary one athlete's performance by X%)
          </Label>
        </div>
        {includeSensitivity && selectedAthletes.size > 0 && (
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-sm text-slate-700 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              See how team score changes if this athlete performs X% better or worse (faster/slower for swimmers, higher/lower score for divers).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Athlete:</Label>
                <Select
                  value={sensitivityAthleteId ?? ""}
                  onValueChange={(val) => setSensitivityAthleteId(val || null)}
                >
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder="Select athlete" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAthletes
                      .filter((a) => selectedAthletes.has(a.id))
                      .map((athlete) => (
                        <SelectItem key={athlete.id} value={athlete.id}>
                          {formatName(athlete.firstName, athlete.lastName)}
                          {athlete.year && ` (${athlete.year})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Percent variation:</Label>
                <Select
                  value={String(sensitivityPercent)}
                  onValueChange={(val) => setSensitivityPercent(Number(val))}
                >
                  <SelectTrigger className="w-[100px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Swimmers */}
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Swimmers ({swimmers.filter((a) => selectedAthletes.has(a.id)).length} selected)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
            {swimmers.map((athlete) => (
              <div key={athlete.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`athlete-${athlete.id}`}
                  checked={selectedAthletes.has(athlete.id)}
                  onCheckedChange={() => handleToggleAthlete(athlete.id)}
                />
                <Label
                  htmlFor={`athlete-${athlete.id}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {formatName(athlete.firstName, athlete.lastName)}
                  {athlete.year && (
                    <span className="text-xs text-slate-500 ml-1">({athlete.year})</span>
                  )}
                  {testSpotAthleteIds.includes(athlete.id) && (
                    <Badge variant="secondary" className="ml-1.5 text-xs font-normal">test spot</Badge>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Divers */}
        {divingIncluded && divers.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              Divers ({divers.filter((a) => selectedAthletes.has(a.id)).length} selected)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {divers.map((athlete) => (
                <div key={athlete.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`athlete-${athlete.id}`}
                    checked={selectedAthletes.has(athlete.id)}
                    onCheckedChange={() => handleToggleAthlete(athlete.id)}
                  />
                  <Label
                    htmlFor={`athlete-${athlete.id}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {formatName(athlete.firstName, athlete.lastName)}
                    {athlete.year && (
                      <span className="text-xs text-slate-500 ml-1">({athlete.year})</span>
                    )}
                    {testSpotAthleteIds.includes(athlete.id) && (
                      <Badge variant="secondary" className="ml-1.5 text-xs font-normal">test spot</Badge>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test spot: choose which selected athletes are in the test spot */}
        {includeTestSpot && selectedAthletes.size > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Who is in the test spot?
            </h4>
            <p className="text-xs text-slate-600">
              Assign athletes competing for that one slot. You need at least{" "}
              {Math.max(2, selectedAthletes.size - maxAthletes + 1)} in the test spot when you have {selectedAthletes.size} on the roster to stay within {maxAthletes} scoring.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-amber-50/50">
              {availableAthletes
                .filter((a) => selectedAthletes.has(a.id))
                .map((athlete) => (
                  <div key={athlete.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`testspot-${athlete.id}`}
                      checked={testSpotAthleteIds.includes(athlete.id)}
                      onCheckedChange={() => handleToggleTestSpot(athlete.id)}
                    />
                    <Label
                      htmlFor={`testspot-${athlete.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {formatName(athlete.firstName, athlete.lastName)}
                      {athlete.year && (
                        <span className="text-xs text-slate-500 ml-1">({athlete.year})</span>
                      )}
                    </Label>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Roster Summary */}
        <div className="pt-2 border-t text-sm text-slate-600">
          <p>
            <strong>Selected:</strong> {selectedAthletes.size} athletes
            {hasTestSpot && (
              <> • <strong>{scoringCount.toFixed(2)} scoring</strong> + {testSpotAthleteIds.length} test spot candidate{testSpotAthleteIds.length !== 1 ? "s" : ""}</>
            )}
            {!hasTestSpot && remaining > 0 && ` • ${remaining.toFixed(2)} spots remaining`}
            {!hasTestSpot && remaining < 0 && ` • ${Math.abs(remaining).toFixed(2)} over limit`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
