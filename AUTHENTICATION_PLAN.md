# Authentication Setup Plan

## Current Status
- ✅ NextAuth.js configured with email/password and Google OAuth
- ✅ Signup and signin pages created
- ✅ Database schema updated with User, Account, Session models
- ⚠️ **ISSUE**: Signup functionality not working (needs debugging)
- ⏳ Google OAuth not yet configured
- ⏳ Not yet deployed to production

---

## Phase 1: Fix Signup Functionality (IMMEDIATE)

### Issues to Investigate:
1. **Environment Variables Missing?**
   - Check if `.env.local` exists with:
     - `DATABASE_URL`
     - `NEXTAUTH_SECRET`
     - `NEXTAUTH_URL`

2. **Database Connection?**
   - Verify Prisma can connect to database
   - Check if migrations have been run

3. **Error Handling?**
   - Check browser console for errors
   - Check server logs for API errors
   - Verify error messages are displayed to user

4. **UI Components?**
   - Verify all UI components exist (`Button`, `Input`, `Label`, `Card`)
   - Check if components are properly imported

### Testing Steps:
1. Try to create an account
2. Check browser console (F12) for errors
3. Check terminal/server logs for API errors
4. Verify database has been created and migrated
5. Test with different inputs (valid/invalid)

---

## Phase 2: Test Email/Password Auth (After Phase 1)

### Test Cases:
- [ ] Create new account with email/password
- [ ] Sign in with created account
- [ ] Try to create duplicate account (should fail)
- [ ] Try invalid password (should fail)
- [ ] Try invalid email format (should fail)
- [ ] Verify session persists after login
- [ ] Verify protected routes require authentication
- [ ] Test sign out functionality

---

## Phase 3: Set Up Google OAuth (After Phase 2)

### Steps:
1. **Google Cloud Console Setup** (5-10 minutes)
   - Go to https://console.cloud.google.com/
   - Create new project (or use existing)
   - Enable Google+ API
   - Configure OAuth consent screen
   - Create OAuth 2.0 credentials
   - Add redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://your-domain.vercel.app/api/auth/callback/google` (production)
   - Copy Client ID and Client Secret

2. **Local Environment Variables**
   - Add to `.env.local`:
     ```
     GOOGLE_CLIENT_ID=your_client_id_here
     GOOGLE_CLIENT_SECRET=your_client_secret_here
     ```

3. **Test Google OAuth Locally**
   - Test sign in with Google button
   - Verify user is created in database
   - Verify session works

### Reference:
See `GOOGLE_OAUTH_SETUP.md` for detailed step-by-step instructions.

---

## Phase 4: Prepare for Vercel Deployment

### Environment Variables Needed in Vercel:
```
DATABASE_URL=your_production_database_url
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your_generated_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Database Options for Production:
- **Vercel Postgres** (recommended - easy integration)
- **Supabase** (free tier available)
- **Railway** (PostgreSQL)
- **Neon** (serverless PostgreSQL)

⚠️ **Important**: SQLite (current dev database) is NOT suitable for production. You'll need PostgreSQL.

### Steps:
1. Set up production database (PostgreSQL)
2. Run Prisma migrations on production database
3. Update `DATABASE_URL` in Vercel
4. Add all environment variables in Vercel dashboard
5. Update Google OAuth redirect URI for production domain
6. Deploy to Vercel
7. Test authentication in production

---

## Phase 5: Custom Domain Setup (Optional - Cloudflare)

### If Purchasing Domain on Cloudflare:
1. Purchase domain on Cloudflare
2. In Vercel dashboard:
   - Go to Project → Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions
3. Update environment variables:
   - `NEXTAUTH_URL=https://your-custom-domain.com`
4. Update Google OAuth redirect URI:
   - Add `https://your-custom-domain.com/api/auth/callback/google`
5. Wait for DNS propagation (can take up to 48 hours, usually < 1 hour)
6. Test authentication with custom domain

---

## Phase 6: Email Service Setup (Resend) - After Domain Setup

### Prerequisites:
- ✅ Deployed to Vercel
- ✅ Custom domain configured and verified
- ✅ DNS access available

### Steps:
1. **Deploy to Vercel** (if not already done)
   - Can use Vercel domain initially for testing
   - Full setup requires custom domain

2. **Set up Custom Domain** (Cloudflare or other)
   - Purchase/configure domain
   - Add domain to Vercel project
   - Configure DNS records
   - Wait for DNS propagation

3. **Create Resend Account**
   - Sign up at https://resend.com
   - Free tier: 3,000 emails/month
   - Get API key from dashboard

4. **Verify Domain in Resend**
   - Add domain in Resend dashboard
   - Add DNS records provided by Resend:
     - SPF record
     - DKIM record
     - Optionally: DMARC record
   - Wait for verification (usually < 5 minutes)

5. **Add Resend API Key to Vercel**
   - Go to Vercel → Project → Settings → Environment Variables
   - Add: `RESEND_API_KEY=your_resend_api_key`
   - Redeploy if needed

6. **Implement Password Reset Flow**
   - Create "Forgot Password" page
   - Create API route: `/api/auth/forgot-password`
   - Create API route: `/api/auth/reset-password`
   - Create reset password page with token validation
   - Install Resend package: `npm install resend`
   - Create email templates using React Email
   - Test end-to-end flow

7. **Test in Production**
   - Test password reset flow
   - Verify emails are delivered
   - Check spam folder if needed
   - Verify reset links work correctly

### Why After Domain Setup:
- Domain verification improves email deliverability
- Reduces risk of emails going to spam
- Professional sender address (e.g., `noreply@yourdomain.com`)
- Better email reputation

### Alternative: Can Build UI Now
- Can create password reset UI and flow now
- Use placeholder email service for testing
- Wire up Resend integration after domain setup

---

## Checklist Summary

### Before OAuth Setup:
- [ ] Fix signup functionality
- [ ] Test email/password authentication
- [ ] Verify all protected routes work
- [ ] Test sign out functionality

### OAuth Setup:
- [ ] Create Google Cloud Console project
- [ ] Configure OAuth consent screen
- [ ] Create OAuth credentials
- [ ] Add redirect URIs (dev + production)
- [ ] Add credentials to `.env.local`
- [ ] Test Google sign-in locally

### Production Deployment:
- [ ] Set up production database (PostgreSQL)
- [ ] Run migrations on production database
- [ ] Generate `NEXTAUTH_SECRET`
- [ ] Add all environment variables to Vercel
- [ ] Deploy to Vercel
- [ ] Test authentication in production
- [ ] Set up custom domain (if applicable)
- [ ] Update OAuth redirect URIs for production
- [ ] Final production testing

### Email Service Setup (Resend):
- [ ] Deploy to Vercel (can use Vercel domain initially)
- [ ] Set up custom domain (Cloudflare)
- [ ] Create Resend account
- [ ] Verify domain in Resend (add DNS records: SPF, DKIM)
- [ ] Add Resend API key to Vercel environment variables
- [ ] Implement password reset flow with Resend integration
- [ ] Test password reset in production

---

## Notes

- **NextAuth.js is FREE** - no subscription needed
- **Google OAuth is FREE** - no cost for reasonable usage
- **Vercel hosting** - free tier available (sufficient for most use cases)
- **Database** - need PostgreSQL for production (free tiers available)

---

## Troubleshooting

### Signup Not Working:
1. Check browser console for client-side errors
2. Check server terminal for API errors
3. Verify `.env.local` exists with required variables
4. Verify database is running and accessible
5. Check Prisma migrations have been run
6. Verify UI components exist and are imported correctly

### OAuth Not Working:
1. Verify redirect URI matches exactly (no trailing slashes)
2. Check Google Cloud Console credentials are correct
3. Verify environment variables are set
4. Check OAuth consent screen is configured
5. If in "Testing" mode, add your email as test user

### Production Issues:
1. Verify all environment variables are set in Vercel
2. Check database connection string is correct
3. Verify `NEXTAUTH_URL` matches your production domain
4. Check Google OAuth redirect URI includes production domain
5. Review Vercel deployment logs for errors
