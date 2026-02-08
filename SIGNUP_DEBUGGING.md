# Signup Debugging Guide

## What I Just Fixed

I improved the error handling in the signup page to:
1. Better catch and display validation errors
2. Handle JSON parsing errors gracefully
3. Show more detailed error messages from the server

## How to Debug the Signup Issue

### Step 1: Check Environment Variables

Create or verify `.env.local` in the project root with:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 2: Verify Database Setup

1. **Check if database exists:**
   ```bash
   ls prisma/dev.db
   ```

2. **Run migrations if needed:**
   ```bash
   npx prisma migrate dev
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

### Step 3: Test Signup with Browser DevTools

1. **Open browser DevTools** (F12)
2. **Go to Console tab** - look for any JavaScript errors
3. **Go to Network tab** - try to sign up and watch for:
   - The `/api/auth/signup` request
   - Check the response status (should be 201 for success, 400/500 for errors)
   - Check the response body for error messages

### Step 4: Check Server Logs

When you try to sign up, check your terminal where `npm run dev` is running. Look for:
- Any error messages
- Database connection errors
- Prisma errors

### Step 5: Common Issues & Solutions

#### Issue: "Cannot find module '@/lib/prisma'"
**Solution:** Make sure `src/lib/prisma.ts` exists and exports `prisma`

#### Issue: "Database connection error"
**Solution:** 
- Verify `DATABASE_URL` in `.env.local`
- Make sure database file exists
- Run `npx prisma migrate dev`

#### Issue: "User already exists" (but you haven't created one)
**Solution:** 
- Check if database has old data: `npx prisma studio`
- Or reset database: `npx prisma migrate reset` (⚠️ deletes all data)

#### Issue: No error shown, but nothing happens
**Solution:**
- Check browser console for JavaScript errors
- Check Network tab for failed requests
- Verify UI components exist (`Button`, `Input`, `Label`, `Card`)

### Step 6: Test the API Directly

You can test the signup API directly using curl or Postman:

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

Expected response (success):
```json
{"message":"User created successfully","userId":"..."}
```

Expected response (error):
```json
{"error":"User with this email already exists"}
```

## Next Steps After Fixing

Once signup works:
1. Test creating an account
2. Test signing in with that account
3. Verify you can access protected routes
4. Then proceed with Google OAuth setup

## Still Having Issues?

If signup still doesn't work after these steps:
1. Share the error message from browser console
2. Share the error from server terminal
3. Share the Network tab response for `/api/auth/signup`
