"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Users } from "lucide-react";
import { formatName } from "@/lib/utils";
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

  const currentCount = calculateRosterCount(selectedAthletes);
  const isValid = currentCount <= maxAthletes;
  const remaining = maxAthletes - currentCount;

  const handleToggleAthlete = (athleteId: string) => {
    const newSelected = new Set(selectedAthletes);
    
    if (newSelected.has(athleteId)) {
      newSelected.delete(athleteId);
    } else {
      // Check if adding would exceed limit
      newSelected.add(athleteId);
      const newCount = calculateRosterCount(newSelected);
      if (newCount > maxAthletes) {
        toast.error(`Adding this athlete would exceed the ${maxAthletes} athlete limit`);
        return;
      }
    }

    setSelectedAthletes(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/rosters/${meetTeam.teamId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          athleteIds: Array.from(selectedAthletes),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save roster");
      }

      toast.success(`${team.name} roster saved successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  const swimmers = availableAthletes.filter((a) => !a.isDiver);
  const divers = availableAthletes.filter((a) => a.isDiver);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{team.name}</CardTitle>
            <CardDescription>
              Select up to {maxAthletes} athletes (divers count as {diverRatio} of a swimmer)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Valid ({currentCount.toFixed(2)}/{maxAthletes})
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Over Limit ({currentCount.toFixed(2)}/{maxAthletes})
              </Badge>
            )}
            <Button onClick={handleSave} disabled={!isValid || saving} size="sm">
              {saving ? "Saving..." : "Save Roster"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
            {remaining > 0 && ` • ${remaining.toFixed(2)} spots remaining`}
            {remaining < 0 && ` • ${Math.abs(remaining).toFixed(2)} over limit`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
