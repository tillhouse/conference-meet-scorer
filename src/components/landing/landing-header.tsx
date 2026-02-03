"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Trophy className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-slate-900">Meet Scorer</span>
        </Link>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/auth/signin">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signup">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
