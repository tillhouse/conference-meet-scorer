"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Search, Building2, Upload, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { BulkUploadDialog } from "@/components/teams/bulk-upload-dialog";
import { RosterManagement } from "@/components/teams/roster-management";
import Link from "next/link";
import { toast } from "sonner";

interface CompetitorTeam {
  id: string;
  competitorTeam: {
    id: string;
    name: string;
    shortName: string | null;
    schoolName: string | null;
    primaryColor: string | null;
    _count: {
      athletes: number;
    };
  };
}

interface CompetitorRostersProps {
  teamAccountId: string;
  primaryTeamName: string;
  primaryTeamSchoolName: string | null;
  canEdit: boolean;
}

interface CompetitorAthlete {
  id: string;
  firstName: string;
  lastName: string;
  year: string | null;
  isDiver: boolean;
  isEnabled: boolean;
  eventTimes: {
    id: string;
    time: string;
    isEntered: boolean;
    isRelaySplit: boolean;
    event: {
      id: string;
      name: string;
    };
  }[];
}

export function CompetitorRosters({
  teamAccountId,
  primaryTeamName,
  primaryTeamSchoolName,
  canEdit,
}: CompetitorRostersProps) {
  const [competitors, setCompetitors] = useState<CompetitorTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [competitorAthletes, setCompetitorAthletes] = useState<CompetitorAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [selectedCompetitorTeamName, setSelectedCompetitorTeamName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({
    schoolName: "",
    programType: "" as "mens" | "womens" | "coed" | "",
    name: "",
    shortName: "",
    primaryColor: "#3b82f6",
  });

  useEffect(() => {
    loadCompetitors();
  }, [teamAccountId]);

  const loadCompetitors = async () => {
    try {
      const response = await fetch(`/api/teams/${teamAccountId}/competitors`);
      if (!response.ok) {
        throw new Error("Failed to load competitor teams");
      }
      const data = await response.json();
      setCompetitors(data);
    } catch (error) {
      console.error("Error loading competitors:", error);
      toast.error("Failed to load competitor teams");
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitorAthletes = async (competitorTeamId: string) => {
    setLoadingAthletes(true);
    try {
      const response = await fetch(`/api/athletes?teamId=${competitorTeamId}`);
      if (!response.ok) {
        throw new Error("Failed to load athletes");
      }
      const data = await response.json();
      setCompetitorAthletes(data);
    } catch (error) {
      console.error("Error loading athletes:", error);
      toast.error("Failed to load athlete roster");
      setCompetitorAthletes([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const handleSelectCompetitor = (competitorId: string, competitorName: string) => {
    if (selectedCompetitorId === competitorId) {
      setSelectedCompetitorId(null);
      setCompetitorAthletes([]);
      setSelectedCompetitorTeamName("");
    } else {
      setSelectedCompetitorId(competitorId);
      setSelectedCompetitorTeamName(competitorName);
      loadCompetitorAthletes(competitorId);
    }
  };

  const updateTeamName = (type: string) => {
    let fullName = "";
    if (type) {
      if (type === "mens") {
        fullName = "Men's Swimming";
      } else if (type === "womens") {
        fullName = "Women's Swimming";
      } else if (type === "coed") {
        fullName = "Co-ed Swimming";
      }
    }
    setNewTeam((prev) => ({
      ...prev,
      name: fullName,
      programType: type as "mens" | "womens" | "coed" | "",
    }));
  };

  const handleCreateTeam = async () => {
    if (!newTeam.schoolName || !newTeam.programType || !newTeam.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      // Create the team
      const createResponse = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeam.name,
          shortName: newTeam.shortName || undefined,
          schoolName: newTeam.schoolName,
          primaryColor: newTeam.primaryColor,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || "Failed to create team");
      }

      const createdTeam = await createResponse.json();

      // Automatically add it as a competitor
      const addResponse = await fetch(`/api/teams/${teamAccountId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorTeamId: createdTeam.id }),
      });

      if (!addResponse.ok) {
        const error = await addResponse.json();
        throw new Error(error.error || "Team created but failed to add to master database");
      }

      // Refresh the data
      await loadCompetitors();

      // Reset form and close dialog
      setNewTeam({
        schoolName: "",
        programType: "",
        name: "",
        shortName: "",
        primaryColor: "#3b82f6",
      });
      setShowCreateDialog(false);
      toast.success("Competitor team created and added to master database");
    } catch (error: any) {
      toast.error(error.message || "Failed to create competitor team");
    } finally {
      setCreating(false);
    }
  };

  const filteredCompetitors = competitors.filter((c) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      c.competitorTeam.name.toLowerCase().includes(searchLower) ||
      c.competitorTeam.schoolName?.toLowerCase().includes(searchLower) ||
      c.competitorTeam.shortName?.toLowerCase().includes(searchLower)
    );
  });

  const selectedCompetitor = competitors.find(
    (c) => c.competitorTeam.id === selectedCompetitorId
  );

  // Get all teams for bulk upload (primary team + competitors)
  const allTeamsForUpload = [
    {
      id: teamAccountId,
      name: primaryTeamName,
      schoolName: primaryTeamSchoolName,
    },
    ...competitors.map((c) => ({
      id: c.competitorTeam.id,
      name: c.competitorTeam.name,
      schoolName: c.competitorTeam.schoolName,
    })),
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-slate-500">Loading competitor teams...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selectedCompetitorId ? (
        // Show selected competitor's roster
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCompetitorId(null);
                setCompetitorAthletes([]);
              }}
            >
              ← Back to Competitors
            </Button>
            <div className="flex items-center gap-2">
              {selectedCompetitor?.competitorTeam.primaryColor && (
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedCompetitor.competitorTeam.primaryColor }}
                />
              )}
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedCompetitor?.competitorTeam.name}
              </h2>
            </div>
            {selectedCompetitor?.competitorTeam.schoolName && (
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 className="h-4 w-4" />
                <span>{selectedCompetitor.competitorTeam.schoolName}</span>
              </div>
            )}
          </div>

          {loadingAthletes ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-slate-500">Loading athletes...</div>
              </CardContent>
            </Card>
          ) : (
            <RosterManagement
              athletes={competitorAthletes}
              teamId={selectedCompetitorId}
              teamName={selectedCompetitorTeamName}
              canEdit={canEdit}
            />
          )}
        </div>
      ) : (
        // Show list of competitor teams
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    My Competitors
                  </CardTitle>
                  <CardDescription>
                    View and manage rosters for competitor teams in your master database
                  </CardDescription>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Competitor
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create New Competitor Team</DialogTitle>
                          <DialogDescription>
                            Create a new competitor team and add it to your master database. You can
                            upload rosters and times for this team after creating it.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="schoolName">School Name *</Label>
                            <Input
                              id="schoolName"
                              value={newTeam.schoolName}
                              onChange={(e) =>
                                setNewTeam({ ...newTeam, schoolName: e.target.value })
                              }
                              placeholder="Harvard University"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="programType">Program Type *</Label>
                            <Select
                              value={newTeam.programType}
                              onValueChange={(value) => updateTeamName(value)}
                              required
                            >
                              <SelectTrigger id="programType">
                                <SelectValue placeholder="Select program type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mens">Men's</SelectItem>
                                <SelectItem value="womens">Women's</SelectItem>
                                <SelectItem value="coed">Co-ed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="name">Full Team Name</Label>
                            <Input
                              id="name"
                              value={newTeam.name}
                              onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                              placeholder="Men's Swimming"
                              disabled
                              className="bg-slate-50"
                            />
                            <p className="text-xs text-slate-500">
                              Auto-generated from program type. You can edit if needed.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="shortName">Short Name</Label>
                            <Input
                              id="shortName"
                              value={newTeam.shortName}
                              onChange={(e) => setNewTeam({ ...newTeam, shortName: e.target.value })}
                              placeholder="HARV-M or HARV-W"
                            />
                            <p className="text-xs text-slate-500">
                              Optional: Abbreviation for meets (e.g., "HARV-M" for Men's, "HARV-W" for
                              Women's)
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="primaryColor">Primary Color</Label>
                            <div className="flex gap-2">
                              <Input
                                id="primaryColor"
                                type="color"
                                value={newTeam.primaryColor}
                                onChange={(e) =>
                                  setNewTeam({ ...newTeam, primaryColor: e.target.value })
                                }
                                className="w-20 h-10"
                              />
                              <Input
                                value={newTeam.primaryColor}
                                onChange={(e) =>
                                  setNewTeam({ ...newTeam, primaryColor: e.target.value })
                                }
                                placeholder="#3b82f6"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                            disabled={creating}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleCreateTeam} disabled={creating}>
                            {creating ? "Creating..." : "Create Team"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" onClick={() => setShowBulkUploadDialog(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Upload
                    </Button>
                  </div>
                )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitors.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p>No competitor teams yet.</p>
                <p className="text-sm mt-2">
                  {canEdit
                    ? "Click 'Add Competitor' above to create your first competitor team."
                    : "Ask a team admin to add competitor teams."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search competitors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredCompetitors.map((competitor) => (
                    <Card
                      key={competitor.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() =>
                        handleSelectCompetitor(
                          competitor.competitorTeam.id,
                          competitor.competitorTeam.name
                        )
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {competitor.competitorTeam.primaryColor && (
                              <div
                                className="h-4 w-4 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: competitor.competitorTeam.primaryColor,
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900">
                                {competitor.competitorTeam.name}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                                {competitor.competitorTeam.schoolName && (
                                  <>
                                    <Building2 className="h-3 w-3" />
                                    <span>{competitor.competitorTeam.schoolName}</span>
                                  </>
                                )}
                                {competitor.competitorTeam.shortName && (
                                  <span className="ml-2">
                                    ({competitor.competitorTeam.shortName})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Users className="h-4 w-4 text-slate-400" />
                              <span>{competitor.competitorTeam._count.athletes} athletes</span>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredCompetitors.length === 0 && searchQuery && (
                  <div className="text-center py-8 text-slate-500">
                    No competitors match your search.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Bulk Upload Dialog */}
        {canEdit && (
          <BulkUploadDialog
            open={showBulkUploadDialog}
            onOpenChange={setShowBulkUploadDialog}
            teams={allTeamsForUpload}
          />
        )}
      </div>
      )}
    </div>
  );
}
