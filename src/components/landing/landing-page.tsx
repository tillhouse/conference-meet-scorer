"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingHeader } from "./landing-header";
import { Trophy, Users, BarChart3, Zap } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <LandingHeader />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                  Optimize Your
                  <span className="text-blue-600"> Championship Meet</span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Plan rosters, simulate meets, and maximize points with intelligent lineup optimization for college swimming championships.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg px-8 py-6">
                  <Link href="/auth/signup">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                  <Link href="/auth/signin">Log In</Link>
                </Button>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3 pt-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200">
                  <Trophy className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Meet Simulation</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Advanced Analytics</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Team Collaboration</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Real-time Updates</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="relative">
              <div className="relative max-w-lg mx-auto">
                <img
                  src="/Swimming Pool.png"
                  alt="Swimming pool at a championship meet"
                  className="w-full h-auto rounded-lg shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything you need to plan the perfect meet
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From roster selection to final scoring, streamline your championship meet planning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg border border-slate-200 hover:shadow-lg transition-shadow">
              <Trophy className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Meet Simulation
              </h3>
              <p className="text-slate-600">
                Run simulations to see projected scores, optimize lineups, and test different strategies before the meet.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-slate-200 hover:shadow-lg transition-shadow">
              <BarChart3 className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Advanced Analytics
              </h3>
              <p className="text-slate-600">
                Track team performance, analyze point distribution, and identify opportunities to maximize scoring potential.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-slate-200 hover:shadow-lg transition-shadow">
              <Users className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Team Collaboration
              </h3>
              <p className="text-slate-600">
                Invite coaches and assistants to collaborate on meets in real-time, with role-based permissions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
