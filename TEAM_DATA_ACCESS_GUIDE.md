# Team Data Upload & Access Guide

## Current Architecture

### 1. **Where to Upload Data**

You can upload athlete data for teams in **three places**:

#### A. Master Database (Team Account Page)
- **Location**: Go to your Team Account page → "Master Database" tab → "Upload Data" tab
- **What it does**: Upload CSV files with data for **multiple teams at once**
- **Requirements**: Your CSV must include a "Team" column that matches team names in your master database
- **Who can use**: All Team Account members with appropriate permissions (owner, admin, coach)

#### B. Individual Team Roster Page
- **Location**: Go to your Team Account page → "Roster" tab → Upload button
- **What it does**: Upload CSV files for **one specific team** (your primary team)
- **Requirements**: Standard CSV format (no "Team" column needed)
- **Who can use**: All Team Account members with appropriate permissions

#### C. Meet Page
- **Location**: Go to a specific meet → "Upload Data" page
- **What it does**: Upload CSV files with data for **multiple teams in that meet**
- **Requirements**: Your CSV must include a "Team" column
- **Who can use**: Meet collaborators with appropriate permissions

### 2. **Data Persistence**

**Important**: All data uploads (from any location) are saved to the **team's database**, not just the meet. This means:
- Data uploaded for a team is available for **all meets** using that team
- Data persists across multiple meet simulations
- You can upload data once and use it in multiple meets

### 3. **Access Control - Current Model**

#### Team Accounts
- **Owner**: The user who created the Team Account (e.g., "Princeton Men's Swimming")
- **Members**: Users invited to the Team Account with roles:
  - **Owner**: Full access
  - **Admin**: Can manage members, upload data, create meets
  - **Coach/Editor**: Can upload data, create meets, edit rosters
  - **Assistant/Contributor**: Can upload data, view rosters
  - **Viewer**: Read-only access

#### Competitor Teams
- **Current Behavior**: 
  - Competitor teams are **owned by the user who created them**
  - They're added to a Team Account's master database via the `TeamCompetitor` relationship
  - **All members of the Team Account** can see and use competitor teams in meets
  - However, only the **owner of the competitor team** can edit/delete the competitor team itself

#### Access to Master Database
- **Who can access**: All Team Account members (owner, admin, coach, assistant, viewer)
- **What they can do**:
  - **View**: All members can see the master database (primary team + competitor teams)
  - **Upload data**: Members with appropriate roles (admin, coach, assistant) can upload data
  - **Add/remove competitors**: Only owner and admin can manage competitor teams
  - **Create meets**: Members with appropriate roles can create meets using teams from the master database

### 4. **Current Limitations & Questions**

#### Issue: Competitor Team Ownership
Currently, when you create a competitor team from your Team Account:
- The competitor team is **owned by you** (the user who created it)
- It's added to your Team Account's master database
- **But**: Other Team Account members can see it, but may not be able to fully manage it

#### Question: Should Competitor Teams Be Team Account Assets?
There are two possible models:

**Option A: Competitor teams are user-owned (current)**
- Pros: Clear ownership, user can take teams to other accounts
- Cons: Other team members can't fully manage competitor teams

**Option B: Competitor teams are Team Account assets**
- Pros: All team members have equal access to manage competitor teams
- Cons: Teams can't be easily moved between accounts

### 5. **Recommended Improvements**

Based on your use case (coaches managing competitor data for meet projections), I recommend:

1. **Make competitor teams Team Account assets** (not user-owned)
   - When created from a Team Account, they should be owned by the Team Account
   - All Team Account members with appropriate roles can manage them
   - This makes more sense for collaborative team management

2. **Clarify upload locations in UI**
   - Add clear labels: "Upload for all teams" vs "Upload for this team only"
   - Show which teams will receive data before uploading

3. **Add individual team upload pages**
   - Allow uploading data for a specific competitor team directly
   - Currently, you can only upload for all teams or your primary team

Would you like me to implement these improvements?
