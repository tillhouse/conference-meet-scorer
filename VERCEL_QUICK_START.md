# Vercel Deployment - Quick Start Guide

## 🚀 Step-by-Step Deployment

### Step 1: Update Prisma Schema for PostgreSQL

**File:** `prisma/schema.prisma`

Change line 9 from:
```prisma
provider = "sqlite"
```

To:
```prisma
provider = "postgresql"
```

Then commit and push:
```powershell
git add prisma/schema.prisma
git commit -m "Update Prisma schema for PostgreSQL"
git push origin main
```

---

### Step 2: Set Up Vercel Postgres Database

1. Go to https://vercel.com/dashboard
2. Click **Add New...** → **Project**
3. Import your GitHub repo: `tillhouse/conference-meet-scorer`
4. In the project setup, go to **Storage** tab
5. Click **Create Database** → Select **Postgres**
6. Choose a name (e.g., "conference-meet-scorer-db")
7. Select a region close to you
8. **Copy the `POSTGRES_URL`** - you'll need this!

---

### Step 3: Generate NEXTAUTH_SECRET

Run this in PowerShell:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Save this secret** - you'll need it in the next step.

---

### Step 4: Configure Environment Variables in Vercel

In your Vercel project setup page:

1. Scroll to **Environment Variables** section
2. Add these three variables:

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `DATABASE_URL` | `[paste POSTGRES_URL from Step 2]` | From Vercel Postgres |
| `NEXTAUTH_URL` | `https://your-app-name.vercel.app` | Will be shown after first deploy |
| `NEXTAUTH_SECRET` | `[paste secret from Step 3]` | Generated in Step 3 |

**Important:** 
- Add these for **Production**, **Preview**, and **Development**
- For `NEXTAUTH_URL`, you can use a placeholder like `https://conference-meet-scorer.vercel.app` initially, then update it after the first deploy

---

### Step 5: Deploy to Vercel

1. Click **Deploy** in Vercel
2. Wait for the build to complete (it may fail on first try - that's OK!)

---

### Step 6: Run Database Migrations

After the first deployment:

1. **Install Vercel CLI** (if needed):
   ```powershell
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```powershell
   vercel login
   ```

3. **Link your project**:
   ```powershell
   vercel link
   ```
   Select your project when prompted.

4. **Pull environment variables**:
   ```powershell
   vercel env pull .env.production
   ```

5. **Run migrations**:
   ```powershell
   npx prisma migrate deploy
   ```

6. **Generate Prisma Client**:
   ```powershell
   npx prisma generate
   ```

---

### Step 7: Update NEXTAUTH_URL and Redeploy

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Find `NEXTAUTH_URL` and update it to your actual Vercel URL (e.g., `https://conference-meet-scorer.vercel.app`)
3. Go to **Deployments** tab
4. Click **Redeploy** on the latest deployment

---

### Step 8: Test Your Deployment

Visit your Vercel URL and test:
- ✅ Landing page loads
- ✅ Sign up works
- ✅ Sign in works
- ✅ Dashboard loads
- ✅ Can create teams

---

## 🆘 Troubleshooting

### Build fails?
- Make sure you've updated `prisma/schema.prisma` to use `postgresql`
- Check that all environment variables are set

### Database connection errors?
- Verify `DATABASE_URL` is set correctly
- Make sure migrations have been run (Step 6)

### Authentication not working?
- Check `NEXTAUTH_URL` matches your Vercel domain exactly
- Verify `NEXTAUTH_SECRET` is set

---

## 📋 Checklist

- [ ] Updated Prisma schema to PostgreSQL
- [ ] Created Vercel Postgres database
- [ ] Generated NEXTAUTH_SECRET
- [ ] Set all environment variables in Vercel
- [ ] Deployed to Vercel
- [ ] Ran database migrations
- [ ] Updated NEXTAUTH_URL to actual domain
- [ ] Redeployed
- [ ] Tested signup/signin

---

**Need more details?** See `VERCEL_DEPLOYMENT_GUIDE.md` for the full guide.
