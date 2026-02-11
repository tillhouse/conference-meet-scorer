import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BackToMeetButtonProps {
  meetId: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function BackToMeetButton({ 
  meetId, 
  variant = "outline",
  className 
}: BackToMeetButtonProps) {
  return (
    <Button variant={variant} asChild className={className}>
      <Link href={`/meets/${meetId}`}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Meet
      </Link>
    </Button>
  );
}
