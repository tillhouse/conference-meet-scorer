"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Plus, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Meet {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  status: string;
  meetType: string;
  _count: {
    meetTeams: number;
  };
}

interface TeamMeetsProps {
  teamAccountId: string;
}

export function TeamMeets({ teamAccountId }: TeamMeetsProps) {
  const [meets, setMeets] = useState<Meet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeets();
  }, [teamAccountId]);

  const loadMeets = async () => {
    try {
      const response = await fetch(`/api/teams/${teamAccountId}/meets`);
      if (!response.ok) throw new Error("Failed to load meets");
      const data = await response.json();
      setMeets(data);
    } catch (error) {
      console.error("Error loading meets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Meets</CardTitle>
            <CardDescription>
              Create and manage meets using teams from your master database
            </CardDescription>
          </div>
          <Button asChild>
            <Link href={`/meets/new?teamAccountId=${teamAccountId}`}>
              <Plus className="h-4 w-4 mr-2" />
              New Meet
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {meets.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p>No meets yet</p>
            <p className="text-sm mt-2">
              Create a meet to start projecting results using teams from your master database
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meets.map((meet) => (
              <Card key={meet.id} className="hover:shadow-lg transition-shadow">
                <Link href={`/meets/${meet.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{meet.name}</CardTitle>
                      <Badge variant={meet.status === "completed" ? "default" : "secondary"}>
                        {meet.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {meet.meetType === "championship" ? "Championship" : "Dual"} Meet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {meet.date && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(meet.date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {meet.location && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span>{meet.location}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t">
                        <span className="text-slate-600">
                          {meet._count.meetTeams} team{meet._count.meetTeams !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
