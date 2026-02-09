"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [programType, setProgramType] = useState<"mens" | "womens" | "coed" | "">("");
  const [sportName, setSportName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    schoolName: "",
    primaryColor: "#3b82f6",
    secondaryColor: "",
  });

  // Update team name when program type or sport name changes
  const updateTeamName = (type: string, sport: string) => {
    let fullName = "";
    if (type && sport) {
      if (type === "mens") {
        fullName = `Men's ${sport}`;
      } else if (type === "womens") {
        fullName = `Women's ${sport}`;
      } else if (type === "coed") {
        fullName = `Co-ed ${sport}`;
      } else {
        fullName = sport;
      }
    } else if (sport) {
      fullName = sport;
    }
    setFormData({ ...formData, name: fullName });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!programType || !sportName || !formData.schoolName) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || "Failed to create team";
        const errorDetails = error.details ? `: ${JSON.stringify(error.details)}` : "";
        throw new Error(errorMessage + errorDetails);
      }

      const team = await response.json();
      toast.success("Team created successfully!");
      router.push(`/teams/${team.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/teams">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create New Team</h1>
          <p className="text-slate-600 mt-1">
            Add a new team to start managing rosters
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Team Information</CardTitle>
          <CardDescription>
            Enter the basic information for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name *</Label>
              <Input
                id="schoolName"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                placeholder="Princeton University"
                required
              />
              <p className="text-xs text-slate-500">
                The school or institution name. Teams from the same school will be grouped together.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="programType">Program Type *</Label>
                <Select
                  value={programType}
                  onValueChange={(value: "mens" | "womens" | "coed" | "") => {
                    setProgramType(value);
                    updateTeamName(value, sportName);
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
                <Label htmlFor="sportName">Sport/Program Name *</Label>
                <Input
                  id="sportName"
                  value={sportName}
                  onChange={(e) => {
                    setSportName(e.target.value);
                    updateTeamName(programType, e.target.value);
                  }}
                  placeholder="Swimming"
                  required
                />
                <p className="text-xs text-slate-500">
                  e.g., "Swimming", "Diving", "Water Polo"
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Team Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Men's Swimming"
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">
                Auto-generated from program type and sport name. You can edit if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortName">Short Name</Label>
              <Input
                id="shortName"
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                placeholder="PRIN-M or PRIN-W"
              />
              <p className="text-xs text-slate-500">
                Optional: Abbreviation for meets (e.g., "PRIN-M" for Men's, "PRIN-W" for Women's)
              </p>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondaryColor || "#ffffff"}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Team"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/teams">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
