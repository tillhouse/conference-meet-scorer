# Conference Meet Scorer - Quick Deployment Script
# Run this script to deploy the application locally

param(
    [switch]$SkipInstall
)

Write-Host "=== Conference Meet Scorer - Local Deployment ===" -ForegroundColor Cyan

# Navigate to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath
Write-Host "`nProject directory: $projectPath" -ForegroundColor Green

# Stop existing processes
Write-Host "`nStopping existing processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Check environment variables
Write-Host "`nChecking environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local..." -ForegroundColor Yellow
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    @"
# Use a PostgreSQL URL. Create DB first: createdb conference_meet_scorer
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/conference_meet_scorer"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$secret"
"@ | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host ".env.local created (using default Postgres URL - edit if needed)" -ForegroundColor Green
} else {
    Write-Host ".env.local exists" -ForegroundColor Green
}

# Install dependencies (if needed)
if (-not $SkipInstall) {
    Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed" -ForegroundColor Red
        exit 1
    }
}

# Generate Prisma Client
Write-Host "`nSetting up database..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Prisma client generation failed" -ForegroundColor Red
    exit 1
}

# Sync schema to database (use db push - migration history was created for SQLite, DB is PostgreSQL)
Write-Host "Syncing database schema..." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Prisma db push failed" -ForegroundColor Red
    exit 1
}

# Start server
Write-Host "`nStarting development server..." -ForegroundColor Yellow
Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

npm run dev
