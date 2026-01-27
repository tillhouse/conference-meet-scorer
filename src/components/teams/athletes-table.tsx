"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { formatName, formatSecondsToTime, normalizeTimeFormat } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
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
type AthleteWithEvents = {
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
};

interface AthletesTableProps {
  athletes: AthleteWithEvents[];
  teamId: string;
}

type SortField = "name" | "year" | "type" | "status";
type SortDirection = "asc" | "desc";

export function AthletesTable({ athletes, teamId }: AthletesTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [athletesList, setAthletesList] = useState(athletes);
  const [expandedAthletes, setExpandedAthletes] = useState<Set<string>>(new Set());
  
  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Update local state when props change
  useEffect(() => {
    setAthletesList(athletes);
  }, [athletes]);

  // Get unique years for filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    athletes.forEach((athlete) => {
      if (athlete.year) {
        years.add(athlete.year);
      }
    });
    return Array.from(years).sort();
  }, [athletes]);

  // Filter and sort athletes
  const filteredAndSortedAthletes = useMemo(() => {
    let filtered = [...athletesList];

    // Apply filters
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase().trim();
      filtered = filtered.filter((athlete) => {
        const fullName = formatName(athlete.firstName, athlete.lastName).toLowerCase();
        return fullName.includes(searchTerm);
      });
    }

    if (yearFilter !== "all") {
      filtered = filtered.filter((athlete) => athlete.year === yearFilter);
    }

    if (typeFilter !== "all") {
      const isDiver = typeFilter === "diver";
      filtered = filtered.filter((athlete) => athlete.isDiver === isDiver);
    }

    if (statusFilter !== "all") {
      const isEnabled = statusFilter === "active";
      filtered = filtered.filter((athlete) => athlete.isEnabled === isEnabled);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          const aName = formatName(a.firstName, a.lastName).toLowerCase();
          const bName = formatName(b.firstName, b.lastName).toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        case "year":
          const yearOrder = ["FR", "SO", "JR", "SR", "GR"];
          const aYearIndex = a.year ? yearOrder.indexOf(a.year) : 999;
          const bYearIndex = b.year ? yearOrder.indexOf(b.year) : 999;
          comparison = aYearIndex - bYearIndex;
          break;
        case "type":
          comparison = Number(a.isDiver) - Number(b.isDiver);
          break;
        case "status":
          comparison = Number(a.isEnabled) - Number(b.isEnabled);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [athletesList, nameFilter, yearFilter, typeFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setNameFilter("");
    setYearFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = nameFilter.trim() || yearFilter !== "all" || typeFilter !== "all" || statusFilter !== "all";

  const handleToggleStatus = async (athleteId: string, currentStatus: boolean) => {
    setTogglingId(athleteId);
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isEnabled: !currentStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }

      // Update local state immediately
      setAthletesList((prev) =>
        prev.map((athlete) =>
          athlete.id === athleteId
            ? { ...athlete, isEnabled: !athlete.isEnabled }
            : athlete
        )
      );

      toast.success(
        `Athlete ${!currentStatus ? "activated" : "deactivated"} successfully`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleType = async (athleteId: string, isCurrentlyDiver: boolean) => {
    setTogglingId(athleteId);
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isDiver: !isCurrentlyDiver,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update type");
      }

      // Update local state immediately
      setAthletesList((prev) =>
        prev.map((athlete) =>
          athlete.id === athleteId
            ? { ...athlete, isDiver: !athlete.isDiver }
            : athlete
        )
      );

      toast.success(
        `Athlete changed to ${!isCurrentlyDiver ? "diver" : "swimmer"} successfully`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update type");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (athleteId: string, athleteName: string) => {
    setDeletingId(athleteId);
    try {
      const response = await fetch(`/api/athletes/${athleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete athlete");
      }

      toast.success(`${athleteName} deleted successfully`);
      // Refresh the page to show updated list
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete athlete");
      setDeletingId(null);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  if (athletes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No athletes yet. Upload a CSV file or add athletes manually.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-slate-50 rounded-md border">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Name</label>
          <Input
            placeholder="Search by name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="min-w-[120px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Year</label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="swimmer">Swimmer</SelectItem>
              <SelectItem value="diver">Diver</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-9"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-600">
        Showing {filteredAndSortedAthletes.length} of {athletes.length} athletes
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Name
                  {getSortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("year")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Year
                  {getSortIcon("year")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("type")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Type
                  {getSortIcon("type")}
                </button>
              </TableHead>
              <TableHead>Events</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Status
                  {getSortIcon("status")}
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedAthletes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No athletes match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedAthletes.map((athlete) => {
                // Filter out relay splits from display (only show individual events)
                const individualEvents = athlete.eventTimes.filter((e) => !e.isRelaySplit);
                const enteredEvents = individualEvents.filter((e) => e.isEntered);
                const allEvents = individualEvents.length;

                return (
              <TableRow key={athlete.id}>
                <TableCell className="font-medium">
                  {formatName(athlete.firstName, athlete.lastName)}
                </TableCell>
                <TableCell>{athlete.year || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={athlete.isDiver ? "secondary" : "default"}
                    className={`cursor-pointer transition-opacity ${
                      togglingId === athlete.id ? "opacity-50" : "hover:opacity-80"
                    }`}
                    onClick={() => handleToggleType(athlete.id, athlete.isDiver)}
                  >
                    {togglingId === athlete.id
                      ? "Updating..."
                      : athlete.isDiver
                      ? "Diver"
                      : "Swimmer"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm">
                      {allEvents} total
                      {enteredEvents.length > 0 && (
                        <span className="text-slate-500">
                          {" "}
                          ({enteredEvents.length} entered)
                        </span>
                      )}
                    </span>
                    {(expandedAthletes.has(athlete.id)
                      ? individualEvents
                      : individualEvents.slice(0, 3)
                    ).map((eventTime) => (
                      <span
                        key={eventTime.id}
                        className="text-xs text-slate-500"
                      >
                        {eventTime.event.name}: {normalizeTimeFormat(eventTime.time)}
                      </span>
                    ))}
                    {individualEvents.length > 3 && (
                      <button
                        onClick={() => {
                          setExpandedAthletes((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(athlete.id)) {
                              newSet.delete(athlete.id);
                            } else {
                              newSet.add(athlete.id);
                            }
                            return newSet;
                          });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left mt-1"
                      >
                        {expandedAthletes.has(athlete.id)
                          ? "Show less"
                          : `+${individualEvents.length - 3} more`}
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={athlete.isEnabled ? "default" : "outline"}
                    className={`cursor-pointer transition-opacity ${
                      togglingId === athlete.id ? "opacity-50" : "hover:opacity-80"
                    }`}
                    onClick={() => handleToggleStatus(athlete.id, athlete.isEnabled)}
                  >
                    {togglingId === athlete.id
                      ? "Updating..."
                      : athlete.isEnabled
                      ? "Active"
                      : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/teams/${teamId}/athletes/${athlete.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === athlete.id}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {formatName(athlete.firstName, athlete.lastName)} and all their event times.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(athlete.id, formatName(athlete.firstName, athlete.lastName))}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
