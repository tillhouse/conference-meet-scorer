"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  schoolName: string | null;
}

interface CompetitorTeamsProps {
  teamAccountId: string;
  canEdit: boolean;
}

export function CompetitorTeams({ teamAccountId, canEdit }: CompetitorTeamsProps) {
  const [competitors, setCompetitors] = useState<CompetitorTeam[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({
    schoolName: "",
    programType: "" as "mens" | "womens" | "coed" | "",
    name: "",
    shortName: "",
    primaryColor: "#3b82f6",
  });

  useEffect(() => {
    loadData();
  }, [teamAccountId]);

  const loadData = async () => {
    try {
      const [competitorsRes, teamsRes] = await Promise.all([
        fetch(`/api/teams/${teamAccountId}/competitors`),
        fetch("/api/teams"),
      ]);

      if (!competitorsRes.ok) {
        const errorData = await competitorsRes.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Failed to load competitor teams");
      }
      if (!teamsRes.ok) {
        throw new Error("Failed to load available teams");
      }

      const competitorsData = await competitorsRes.json();
      const teamsData = await teamsRes.json();

      setCompetitors(competitorsData || []);

      // Filter out teams that are already competitors or the team account itself
      const competitorIds = new Set([
        teamAccountId,
        ...(competitorsData || []).map((c: CompetitorTeam) => c.competitorTeam.id),
      ]);
      const available = teamsData.filter((t: Team) => !competitorIds.has(t.id));
      setAvailableTeams(available);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load data");
      setCompetitors([]);
      setAvailableTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedTeamId) {
      toast.error("Please select a team");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`/api/teams/${teamAccountId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorTeamId: selectedTeamId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add competitor team");
      }

      const newCompetitor = await response.json();
      setCompetitors([...competitors, newCompetitor]);
      setAvailableTeams(availableTeams.filter((t) => t.id !== selectedTeamId));
      setSelectedTeamId("");
      toast.success("Competitor team added to master database");
    } catch (error: any) {
      toast.error(error.message || "Failed to add competitor team");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (competitorTeamId: string) => {
    try {
      const response = await fetch(
        `/api/teams/${teamAccountId}/competitors/${competitorTeamId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove competitor team");
      }

      const removed = competitors.find((c) => c.competitorTeam.id === competitorTeamId);
      if (removed) {
        setAvailableTeams([...availableTeams, removed.competitorTeam]);
      }

      setCompetitors(competitors.filter((c) => c.competitorTeam.id !== competitorTeamId));
      toast.success("Competitor team removed from master database");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove competitor team");
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
      programType: type as "mens" | "womens" | "coed" | "" 
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

      const newCompetitor = await addResponse.json();

      // Refresh the data
      await loadData();

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
    const query = searchQuery.toLowerCase();
    return (
      c.competitorTeam.name.toLowerCase().includes(query) ||
      c.competitorTeam.schoolName?.toLowerCase().includes(query) ||
      c.competitorTeam.shortName?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Competitor Teams</CardTitle>
              <CardDescription>
                Manage competitor teams in your master database. These teams will be available for
                all meets created from this team account.
              </CardDescription>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a team to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.length > 0 ? (
                      availableTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                          {team.schoolName && ` (${team.schoolName})`}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-slate-500">
                        No existing teams available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={handleAdd} disabled={adding || !selectedTeamId}>
                  <Plus className="h-4 w-4 mr-2" />
                  {adding ? "Adding..." : "Add Existing"}
                </Button>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Team
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
                          onValueChange={(value: "mens" | "womens" | "coed" | "") => {
                            updateTeamName(value);
                          }}
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
                        <Label htmlFor="name">Full Team Name *</Label>
                        <Input
                          id="name"
                          value={newTeam.name}
                          onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                          placeholder="Men's Swimming"
                          required
                        />
                        <p className="text-xs text-slate-500">
                          Auto-generated from program type, but you can edit if needed
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="shortName">Short Name</Label>
                        <Input
                          id="shortName"
                          value={newTeam.shortName}
                          onChange={(e) => setNewTeam({ ...newTeam, shortName: e.target.value })}
                          placeholder="HARV-M"
                        />
                        <p className="text-xs text-slate-500">
                          Optional: Abbreviation for meets (e.g., "HARV-M" for Men's)
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
                        {creating ? "Creating..." : "Create & Add to Database"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {competitors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p>No competitor teams yet</p>
              <p className="text-sm mt-2">
                Add teams to your master database to use them in meet projections
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search competitor teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Name</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Athletes</TableHead>
                      {canEdit && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompetitors.map((competitor) => (
                      <TableRow key={competitor.id}>
                        <TableCell className="font-medium">
                          {competitor.competitorTeam.name}
                          {competitor.competitorTeam.shortName && (
                            <span className="text-slate-500 ml-2">
                              ({competitor.competitorTeam.shortName})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {competitor.competitorTeam.schoolName ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              {competitor.competitorTeam.schoolName}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            {competitor.competitorTeam._count.athletes}
                          </div>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Competitor Team?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove{" "}
                                    {competitor.competitorTeam.name} from your master database?
                                    This will not delete the team, but it will no longer be
                                    available for meets created from this team account.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleRemove(competitor.competitorTeam.id)
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
