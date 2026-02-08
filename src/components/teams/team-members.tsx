"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Crown, Shield, Users, Eye, Trash2 } from "lucide-react";
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

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface TeamMembersProps {
  teamId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

const roleLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  owner: { label: "Owner", icon: <Crown className="h-4 w-4 text-yellow-500" /> },
  admin: { label: "Admin", icon: <Shield className="h-4 w-4 text-blue-500" /> },
  coach: { label: "Coach", icon: <Users className="h-4 w-4 text-green-500" /> },
  assistant: { label: "Assistant", icon: <Users className="h-4 w-4 text-slate-500" /> },
  viewer: { label: "Viewer", icon: <Eye className="h-4 w-4 text-slate-400" /> },
};

export function TeamMembers({ teamId, isOwner, isAdmin }: TeamMembersProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "coach" | "assistant" | "viewer">("coach");
  const [inviting, setInviting] = useState(false);

  const canManage = isOwner || isAdmin;

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const loadMembers = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (!response.ok) throw new Error("Failed to load members");
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }

      const newMember = await response.json();
      setMembers([...members, newMember]);
      setInviteEmail("");
      toast.success("Member invited successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      const updated = await response.json();
      setMembers(members.map((m) => (m.id === memberId ? updated : m)));
      toast.success("Role updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      setMembers(members.filter((m) => m.id !== memberId));
      toast.success("Member removed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
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
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage who has access to this team and their roles
            </CardDescription>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-slate-400" />
              <span className="text-sm text-slate-600">{members.length} members</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite Form */}
        {canManage && (
          <form onSubmit={handleInvite} className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="coach@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  disabled={inviting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value: any) => setInviteRole(value)}
                  disabled={inviting}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={inviting} className="w-full">
                  {inviting ? "Inviting..." : "Invite Member"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Members Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-center py-8 text-slate-500">
                    No members yet
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const roleInfo = roleLabels[member.role] || roleLabels.viewer;
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.user.name || "No name"}
                      </TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {roleInfo.icon}
                          <span>{roleInfo.label}</span>
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {member.role !== "owner" && (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(value) => handleUpdateRole(member.id, value)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="coach">Coach</SelectItem>
                                    <SelectItem value="assistant">Assistant</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove {member.user.email} from this team?
                                        They will lose access to all team data.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRemove(member.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
