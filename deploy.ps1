# Conference Meet Scorer - Quick Deployment Script
# Run this script to deploy the application locally

param(
    [switch]$SkipInstall
)

Write-Host "=== Conference Meet Scorer - Local Deployment ===" -ForegroundColor Cyan

# Navigate to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
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
    $dbPath = $projectPath -replace '\\', '/'
    @"
DATABASE_URL="file:$dbPath/prisma/dev.db"
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
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed" -ForegroundColor Red
        exit 1
    }
}

# Generate Prisma Client
Write-Host "`n🗄️  Setting up database..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma client generation failed" -ForegroundColor Red
    exit 1
}

# Check migrations
Write-Host "Checking database migrations..." -ForegroundColor Yellow
npx prisma migrate status | Out-Null

# Start server
Write-Host "`n🚀 Starting development server..." -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Server will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════`n" -ForegroundColor Cyan

npm run dev
