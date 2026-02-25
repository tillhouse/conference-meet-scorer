"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Share2, Copy, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ShareMeetButtonProps {
  meetId: string;
  meetName: string;
  shareToken: string | null;
}

export function ShareMeetButton({ meetId, meetName, shareToken: initialShareToken }: ShareMeetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    setShareToken(initialShareToken);
  }, [initialShareToken]);

  const shareUrl = typeof window !== "undefined" && shareToken
    ? `${window.location.origin}/view/meet/${shareToken}`
    : null;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIsCreating(false);
      setIsRevoking(false);
    }
    setOpen(next);
  };

  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({} as { shareToken?: string; url?: string; error?: string }));
      if (!response.ok) {
        throw new Error(data.error || "Failed to create share link");
      }
      if (data.shareToken) {
        setShareToken(data.shareToken);
        toast.success("Public link created");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    const url = shareUrl ?? (shareToken ? `${window.location.origin}/view/meet/${shareToken}` : "");
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied to clipboard"),
      () => toast.error("Failed to copy")
    );
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/meets/${meetId}/share`, { method: "DELETE" });
      const data = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke link");
      }
      setShareToken(null);
      toast.success("Share link revoked");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke link");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share view-only link</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the meet results and analysis in read-only mode. They
              cannot edit, simulate, or change any data.
              {meetName && (
                <span className="mt-2 block font-medium text-foreground">Meet: {meetName}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareToken ? (
              <>
                <div className="space-y-2">
                  <Label>Public link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareUrl ?? ""}
                      className="font-mono text-sm"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                >
                  {isRevoking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Revoke link
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                No public link yet. Create one to share a read-only view of this meet.
              </p>
            )}
          </div>
          <DialogFooter>
            {!shareToken && (
              <Button
                type="button"
                onClick={handleCreateLink}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                {isCreating ? "Creating..." : "Create public link"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
