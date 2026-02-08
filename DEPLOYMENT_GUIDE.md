# Local Deployment Guide - PowerShell Commands

This guide provides all the PowerShell commands needed to deploy the conference-meet-scorer application locally.

## Prerequisites

- Node.js installed (v18 or higher)
- npm installed
- Git repository cloned

## Step-by-Step Deployment Commands

### 1. Navigate to Project Directory

```powershell
cd "C:\Users\jerem\Documents\GitHub\conference-meet-scorer"
```

### 2. Stop Any Running Processes (if redeploying)

```powershell
# Stop all Node.js processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Clear port 3000 if needed
netstat -ano | findstr ":3000" | ForEach-Object { 
    $pid = ($_ -split '\s+')[-1]
    if ($pid) { 
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue 
    }
}
```

### 3. Verify/Create Environment Variables

```powershell
# Check if .env.local exists
if (Test-Path ".env.local") {
    Write-Host ".env.local exists"
    Get-Content ".env.local"
} else {
    Write-Host "Creating .env.local..."
    
    # Generate NEXTAUTH_SECRET (requires OpenSSL or use a random string)
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    # Create .env.local file
    @"
DATABASE_URL="file:C:/Users/jerem/Documents/GitHub/conference-meet-scorer/prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$secret"
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    
    Write-Host ".env.local created"
}
```

**Alternative:** If you have OpenSSL installed, generate a proper secret:
```powershell
$secret = openssl rand -base64 32
```

### 4. Install Dependencies (if not already installed)

```powershell
npm install
```

### 5. Set Up Database

```powershell
# Generate Prisma Client
npx prisma generate

# Check migration status
npx prisma migrate status

# If migrations are pending, run:
# npx prisma migrate dev
```

### 6. Start Development Server

**Option A: Run in Current Terminal (Recommended for first-time setup)**
```powershell
npm run dev
```

**Option B: Run in Background/New Window**
```powershell
# Start in new minimized PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Minimized
```

### 7. Verify Server is Running

```powershell
# Wait a few seconds for compilation
Start-Sleep -Seconds 10

# Check if port 3000 is in use
netstat -ano | findstr ":3000"

# Test if server responds
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Server is running! Status: $($response.StatusCode)"
} catch {
    Write-Host "⚠️ Server may still be compiling. Wait 30-60 seconds and try again."
}
```

## Quick Deployment Script (All-in-One)

Save this as `deploy.ps1` and run it:

```powershell
# Quick Deployment Script
param(
    [switch]$SkipInstall
)

Write-Host "=== Conference Meet Scorer - Local Deployment ===" -ForegroundColor Cyan

# Navigate to project directory
$projectPath = "C:\Users\jerem\Documents\GitHub\conference-meet-scorer"
Set-Location $projectPath
Write-Host "`n📍 Project directory: $projectPath" -ForegroundColor Green

# Stop existing processes
Write-Host "`n🛑 Stopping existing processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Check environment variables
Write-Host "`n🔧 Checking environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local..." -ForegroundColor Yellow
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    @"
DATABASE_URL="file:C:/Users/jerem/Documents/GitHub/conference-meet-scorer/prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$secret"
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host "✅ .env.local created" -ForegroundColor Green
} else {
    Write-Host "✅ .env.local exists" -ForegroundColor Green
}

# Install dependencies (if needed)
if (-not $SkipInstall) {
    Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Generate Prisma Client
Write-Host "`n🗄️  Setting up database..." -ForegroundColor Yellow
npx prisma generate
npx prisma migrate status

# Start server
Write-Host "`n🚀 Starting development server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

npm run dev
```

**Usage:**
```powershell
# Full deployment (with npm install)
.\deploy.ps1

# Skip npm install (faster if dependencies already installed)
.\deploy.ps1 -SkipInstall
```

## Common Commands Reference

### Check Server Status
```powershell
# Check if port 3000 is in use
netstat -ano | findstr ":3000"

# Check Node.js processes
Get-Process -Name node

# Test server response
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

### Stop Server
```powershell
# Stop all Node.js processes
Get-Process -Name node | Stop-Process -Force

# Or press Ctrl+C in the terminal running npm run dev
```

### View Database
```powershell
# Open Prisma Studio (database GUI)
npx prisma studio
```

### Reset Database (⚠️ Deletes all data)
```powershell
npx prisma migrate reset
```

### View Logs
```powershell
# Server logs appear in the terminal running npm run dev
# Check browser console (F12) for client-side errors
```

## Troubleshooting

### Port 3000 Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr ":3000"

# Stop the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force
```

### Database Connection Error
```powershell
# Verify database file exists
Test-Path "prisma\dev.db"

# Check DATABASE_URL in .env.local
Get-Content ".env.local" | Select-String "DATABASE_URL"

# Reset database (⚠️ deletes data)
npx prisma migrate reset
```

### Module Not Found Errors
```powershell
# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Prisma Client Not Generated
```powershell
# Regenerate Prisma client
npx prisma generate
```

## Access Points

Once deployed, access the application at:

- **Main Application:** http://localhost:3000
- **Sign Up:** http://localhost:3000/auth/signup
- **Sign In:** http://localhost:3000/auth/signin
- **Dashboard:** http://localhost:3000/dashboard (requires authentication)
- **NextAuth API:** http://localhost:3000/api/auth/providers

## Notes

- First compilation may take 30-60 seconds
- Server auto-reloads on file changes
- Database is SQLite (file-based, no separate database server needed)
- All data persists in `prisma/dev.db`
