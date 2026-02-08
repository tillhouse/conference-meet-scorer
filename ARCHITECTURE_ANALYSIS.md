# Architecture Analysis: Current State vs. User Stories

## Current Architecture Issues

### Problem 1: Teams are Global, Not Account-Scoped
**Current:** Teams are created at a global level. Any user can create teams, and teams are separate entities.

**User Story Expectation:** A "Team Account" should be owned by a coach and contain a "Master Database" with multiple teams (their team + competitors).

**Gap:** 
- No concept of "Team Account" as a workspace
- No distinction between "my team" and "competitor teams"
- Each team has isolated data, not a shared master database

### Problem 2: Master Database Missing
**Current:** Each team has its own isolated database of athletes/times.

**User Story Expectation:** There should be a master database within the Team Account that contains:
- The coach's own team data
- Competitor teams' data
- Shared with all team account members
- Editable by members with permissions

**Gap:**
- No master database concept
- Teams are isolated
- No way to distinguish "my team" from "competitor teams"

### Problem 3: Meets Not Created from Team Page
**Current:** Meets are created separately from `/meets/new` and teams are added to them.

**User Story Expectation:** Meets should be created FROM the Team Account page.

**Gap:**
- Meets are separate entities
- No "Create Meet" action on team page
- Teams are added to meets, not the other way around

## Recommended Architecture Changes

### Option A: Add "Team Account" Layer (Recommended)

**New Structure:**
```
TeamAccount (owned by coach)
├── Members (with roles)
├── PrimaryTeam (the coach's team - e.g., "Princeton Men's Swimming")
├── MasterDatabase
│   ├── PrimaryTeam data
│   └── CompetitorTeams data (added to database)
└── Meets (created from this account)
```

**Schema Changes Needed:**
1. Add `TeamAccount` model (or rename `Team` to `TeamAccount`)
2. Add `isPrimaryTeam` flag to distinguish primary vs. competitor teams
3. Add `teamAccountId` to teams to link them to an account
4. Add `teamAccountId` to meets to link them to an account
5. Master database = all teams linked to the same `teamAccountId`

**UI Changes:**
1. "My Teams" page becomes "My Team Accounts"
2. Team Account page shows:
   - Members tab ✅ (already exists)
   - Roster tab (for primary team) ✅ (already exists)
   - Master Database tab (NEW - shows all teams in database)
   - Competitor Teams tab (NEW - manage competitor teams)
   - Meets tab (NEW - create and manage meets from here)
3. Master Database upload (multi-team) ✅ (already exists, just needs better placement)

### Option B: Use Current Team as "Team Account" (Simpler)

**Keep current structure but reframe:**
- The "Team" IS the "Team Account"
- Add concept of "Competitor Teams" to the team's master database
- Add "Create Meet" button to team page
- Master database = primary team + competitor teams

**Schema Changes Needed:**
1. Add `competitorTeams` relationship (many-to-many)
2. Add `isPrimaryTeam` flag (default true for owned teams)
3. Add `teamAccountId` to meets (link to primary team)

**UI Changes:**
1. Team page becomes "Team Account" page
2. Add "Competitor Teams" tab
3. Add "Meets" tab
4. Master Database shows primary + competitor teams

## Recommendation: Option B (Simpler Migration)

**Why:**
- Less schema disruption
- Can build on existing structure
- Clearer mental model: "My Team Account" = the team I own

**Implementation Steps:**
1. Add competitor teams relationship
2. Add "Competitor Teams" tab to team page
3. Add "Meets" tab to team page
4. Reframe "Master Database" as all teams (primary + competitors) in the account
5. Update upload flows to work with master database concept
