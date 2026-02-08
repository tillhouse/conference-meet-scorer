# Vercel Deployment Guide - Step by Step

This guide will walk you through deploying the conference-meet-scorer app to Vercel.

## ⚠️ Important: Database Migration Required

**Your app currently uses SQLite for development, but Vercel requires PostgreSQL for production.** We'll need to:
1. Set up a PostgreSQL database
2. Update Prisma schema to support PostgreSQL
3. Run migrations on the production database

---

## Step 1: Set Up Production Database

You have several options for PostgreSQL:

### Option A: Vercel Postgres (Recommended - Easiest)
1. Go to your Vercel dashboard
2. Navigate to your project (or create a new one)
3. Go to **Storage** tab
4. Click **Create Database** → Select **Postgres**
5. Choose a name and region
6. Vercel will automatically provide the `DATABASE_URL` connection string

### Option B: Supabase (Free tier available)
1. Go to https://supabase.com
2. Create a free account
3. Create a new project
4. Go to **Settings** → **Database**
5. Copy the connection string (it will look like: `postgresql://postgres:[password]@[host]:5432/postgres`)

### Option C: Neon (Serverless PostgreSQL)
1. Go to https://neon.tech
2. Create a free account
3. Create a new project
4. Copy the connection string from the dashboard

**For this guide, I'll assume you're using Vercel Postgres (Option A) as it's the easiest.**

---

## Step 2: Update Prisma Schema for PostgreSQL

We need to update your Prisma schema to use PostgreSQL instead of SQLite.

**File to update:** `prisma/schema.prisma`

Change this:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

To this:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Note:** Some Prisma features differ between SQLite and PostgreSQL. We'll need to check for any SQLite-specific syntax.

---

## Step 3: Generate NEXTAUTH_SECRET

You'll need a secure random string for NextAuth. Generate one using:

**On Windows (PowerShell):**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Or use an online generator:**
- https://generate-secret.vercel.app/32

Save this secret - you'll need it in Step 5.

---

## Step 4: Connect Your GitHub Repository to Vercel

1. Go to https://vercel.com and sign in
2. Click **Add New...** → **Project**
3. Import your GitHub repository: `tillhouse/conference-meet-scorer`
4. Vercel will auto-detect it's a Next.js project

---

## Step 5: Configure Environment Variables in Vercel

Before deploying, add these environment variables in Vercel:

1. In the Vercel project setup, go to **Environment Variables** section
2. Add the following variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string | From Step 1 (Vercel Postgres will auto-populate this) |
| `NEXTAUTH_URL` | `https://your-app-name.vercel.app` | Replace with your actual Vercel domain |
| `NEXTAUTH_SECRET` | The secret you generated in Step 3 | The random string from Step 3 |

**Important:** 
- Make sure to add these for **Production**, **Preview**, and **Development** environments
- Vercel Postgres will automatically add `POSTGRES_URL` - you can use that as `DATABASE_URL` or copy it

---

## Step 6: Update Prisma Schema and Push Changes

1. **Update the schema file** (as described in Step 2)
2. **Commit and push the changes:**
   ```powershell
   git add prisma/schema.prisma
   git commit -m "Update Prisma schema for PostgreSQL production"
   git push origin main
   ```

---

## Step 7: Deploy to Vercel

1. In Vercel, click **Deploy**
2. Vercel will:
   - Install dependencies
   - Run `npm run build`
   - Deploy your app

**First deployment will likely fail** because the database hasn't been migrated yet. That's okay - we'll fix it in the next step.

---

## Step 8: Run Database Migrations on Production

After the first deployment, you need to run Prisma migrations on your production database.

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```powershell
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```powershell
   vercel login
   ```

3. **Link your project:**
   ```powershell
   vercel link
   ```
   Select your project when prompted.

4. **Pull environment variables:**
   ```powershell
   vercel env pull .env.production
   ```

5. **Run migrations:**
   ```powershell
   npx prisma migrate deploy
   ```
   This will run all pending migrations on your production database.

6. **Generate Prisma Client:**
   ```powershell
   npx prisma generate
   ```

### Option B: Using Prisma Studio (Alternative)

1. Set `DATABASE_URL` in your local `.env` file to your production database URL
2. Run:
   ```powershell
   npx prisma migrate deploy
   ```

**⚠️ Warning:** Make sure you're pointing to the production database, not your local one!

---

## Step 9: Redeploy

After running migrations:

1. Go back to Vercel dashboard
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger a new deployment

---

## Step 10: Verify Deployment

1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. Test the following:
   - ✅ Landing page loads
   - ✅ Sign up works
   - ✅ Sign in works
   - ✅ Dashboard loads after login
   - ✅ Can create teams
   - ✅ Can add competitors

---

## Troubleshooting

### Issue: Build fails with Prisma errors
**Solution:** Make sure you've:
- Updated `prisma/schema.prisma` to use `postgresql`
- Run `npx prisma generate` locally
- Committed and pushed the changes

### Issue: Database connection errors
**Solution:** 
- Verify `DATABASE_URL` is set correctly in Vercel
- Check that the database is accessible (not paused)
- Ensure migrations have been run

### Issue: Authentication not working
**Solution:**
- Verify `NEXTAUTH_URL` matches your Vercel domain exactly
- Check that `NEXTAUTH_SECRET` is set
- Make sure environment variables are set for the correct environment (Production)

### Issue: "Module not found" errors
**Solution:**
- Make sure all dependencies are in `package.json`
- Check that `node_modules` is not in `.gitignore` (it shouldn't be)
- Try clearing Vercel's build cache

---

## Post-Deployment Checklist

- [ ] Database migrations completed successfully
- [ ] App loads without errors
- [ ] User signup works
- [ ] User signin works
- [ ] Protected routes require authentication
- [ ] Can create teams
- [ ] Can add competitors
- [ ] CSV uploads work
- [ ] All environment variables are set

---

## Next Steps (Optional)

1. **Set up a custom domain** (if you have one)
2. **Enable preview deployments** for pull requests
3. **Set up monitoring** (Vercel Analytics)
4. **Configure automatic deployments** from main branch

---

## Quick Reference: Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=your-generated-secret-here
```

---

## Need Help?

If you run into issues:
1. Check Vercel deployment logs
2. Check Vercel function logs
3. Verify all environment variables are set
4. Ensure database migrations have run

Good luck with your deployment! 🚀
