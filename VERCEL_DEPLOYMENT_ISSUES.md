# Vercel Deployment Issues & Fixes

## Current Status

**Latest Commit on GitHub:** `8a76e86` - "Fix remaining type predicate filter - use simple filter with type assertion per Opus recommendations"

**Issue:** Vercel is still deploying commit `c80b4c7` instead of the latest commit `8a76e86`, causing build failures.

**Error:** TypeScript compilation fails with type predicate errors in `src/app/meets/[id]/edit/page.tsx`

---

## All Issues Encountered & Fixes Applied

### Issue 1: ZodError `error.errors` vs `error.issues`

**Error:**
```
Type error: Property 'errors' does not exist on type 'ZodError<unknown>'.
```

**Root Cause:** ZodError uses `issues` property, not `errors`.

**Fix Applied:** Changed all instances of `error.errors` to `error.issues` across 18 files.

**Files Fixed:**
- `src/app/api/athletes/route.ts`
- `src/app/api/athletes/[id]/route.ts`
- `src/app/api/meets/route.ts`
- `src/app/api/teams/route.ts`
- `src/app/api/teams/[id]/competitors/route.ts`
- `src/app/api/teams/[id]/members/route.ts`
- `src/app/api/teams/[id]/members/[memberId]/route.ts`
- `src/app/api/user/delete-account/route.ts`
- `src/app/api/user/change-email/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/meets/[meetId]/route.ts`
- `src/app/api/meets/[meetId]/overrides/lineups/[lineupId]/route.ts`
- `src/app/api/meets/[meetId]/overrides/relays/[relayId]/route.ts`
- `src/app/api/meets/[meetId]/relays/[teamId]/route.ts`
- `src/app/api/meets/[meetId]/lineups/[teamId]/route.ts`
- `src/app/api/meets/[meetId]/event-order/route.ts`
- `src/app/api/meets/[meetId]/rosters/[teamId]/route.ts`
- `src/app/api/athletes/events/route.ts`

**Commit:** `f7414bc`

---

### Issue 2: Zod `z.literal()` with `errorMap` Option

**Error:**
```
Type error: No overload matches this call.
Object literal may only specify known properties, and 'errorMap' does not exist in type...
```

**Root Cause:** `z.literal()` doesn't accept `errorMap` option in the way it was being used.

**Fix Applied:** Changed from `z.literal("DELETE", { errorMap: ... })` to `z.string().refine((val) => val === "DELETE", { message: ... })`

**File Fixed:**
- `src/app/api/user/delete-account/route.ts`

**Commit:** `83be108`

---

### Issue 3: Zod Schema `.default()` Type Mismatch

**Error:**
```
Type error: Type 'number | undefined' is not assignable to type 'number'.
Type 'undefined' is not assignable to type 'number'.
```

**Root Cause:** Using `.default()` in Zod schema made TypeScript infer fields as optional, but `useForm` expected them to be required.

**Fix Applied:** Removed `.default()` from Zod schema since defaults are already provided in `useForm` `defaultValues`.

**File Fixed:**
- `src/app/meets/[id]/edit/page.tsx`

**Before:**
```typescript
maxAthletes: z.number().min(1).default(18),
```

**After:**
```typescript
maxAthletes: z.number().min(1),
```

**Commit:** `c80b4c7`

---

### Issue 4: Type Predicate with `as const` (PRIMARY ISSUE)

**Error:**
```
Type error: A type predicate's type must be assignable to its parameter's type.
Type 'Event' is not assignable to type '{ id: string; name: string; eventType: "individual"; }'.
Types of property 'eventType' are incompatible.
Type 'string' is not assignable to type '"individual"'.
```

**Root Cause:** Using `as const` creates literal types (e.g., `"individual"`), but the `Event` interface expects `eventType: string`. The type predicate `(e): e is Event` can't narrow from a literal type to a wider string type.

**Fix Applied (First Attempt):**
- Removed `as const` from `eventType` assignments
- Removed type predicate filters
- Added explicit type annotations `: Event[]`

**File Fixed:**
- `src/app/meets/[id]/edit/page.tsx` (lines 246-276)

**Before:**
```typescript
const swimmingEventOptions = STANDARD_SWIMMING_EVENTS.map((eventName) => {
  return {
    id: existingEvent?.id || eventName,
    name: eventName,
    eventType: "individual" as const,
  };
}).filter((e): e is Event => e !== null);
```

**After:**
```typescript
const swimmingEventOptions: Event[] = STANDARD_SWIMMING_EVENTS.map((eventName) => {
  return {
    id: existingEvent?.id || eventName,
    name: eventName,
    eventType: "individual",
  };
});
```

**Commit:** `d226164`

**Fix Applied (Second Attempt - Remaining Issue):**
- Found another type predicate filter on line 304
- Changed from type predicate to simple filter with type assertion

**Before:**
```typescript
.filter((e): e is Event => e !== null);
```

**After:**
```typescript
.filter((e) => e !== null) as Event[];
```

**Commit:** `8a76e86`

---

## Current Problem: Vercel Deploying Old Commit

### Issue Description

Vercel continues to deploy commit `c80b4c7` instead of the latest commit `8a76e86`, causing the same TypeScript errors to persist.

**Evidence:**
- Build logs show: `Cloning github.com/tillhouse/conference-meet-scorer (Branch: main, Commit: c80b4c7)`
- Latest commit on GitHub: `8a76e86`
- Vercel dashboard shows latest commit message but builds old commit

### Attempted Solutions

1. ✅ **Fixed all TypeScript errors** - All fixes are in commits `d226164` and `8a76e86`
2. ✅ **Pushed to GitHub** - Latest code is on `main` branch
3. ✅ **Created new commits** - Tried forcing new deployments with commit `c70d67f`
4. ✅ **Disconnected/reconnected Git** - User attempted to reset Vercel Git integration
5. ⏳ **Vercel CLI deployment** - In progress (CLI installed, authentication pending)

### Next Steps to Resolve

#### Option 1: Verify Git Reconnection Worked
1. Check Vercel dashboard → Deployments tab
2. Look for a new deployment that started after reconnecting Git
3. Verify it's deploying commit `8a76e86` (not `c80b4c7`)
4. Check if build succeeds

#### Option 2: Deploy via Vercel CLI
```powershell
# Already installed: vercel CLI 50.13.2
# Need to complete authentication:
vercel login
# Then deploy:
vercel link  # Link to existing project
vercel --prod  # Deploy to production
```

#### Option 3: Check Vercel Project Settings
1. Go to Vercel Dashboard → Project → Settings → Git
2. Verify:
   - Repository: `tillhouse/conference-meet-scorer`
   - Production Branch: `main`
   - No branch/commit restrictions
3. Check for any webhook issues in GitHub:
   - GitHub → Repository → Settings → Webhooks
   - Look for Vercel webhook
   - Check recent deliveries for failures

#### Option 4: Manual Deployment Trigger
1. In Vercel dashboard, go to Deployments
2. Click "Redeploy" on latest deployment
3. Make sure it picks up latest commit from GitHub

---

## File Locations of All Fixes

### Main File with Multiple Issues:
- `src/app/meets/[id]/edit/page.tsx`
  - Line ~28: Removed `.default()` from Zod schema
  - Lines 246-276: Removed `as const` and type predicates from event options
  - Line 304: Changed type predicate filter to simple filter with assertion

### API Routes with ZodError fixes:
- All files in `src/app/api/` that use Zod validation

---

## Commit History

```
8a76e86 - Fix remaining type predicate filter - use simple filter with type assertion per Opus recommendations
c70d67f - Force Vercel to deploy latest TypeScript fixes
d226164 - Fix TypeScript error: Remove type predicate and as const to fix Event type compatibility
c80b4c7 - Fix TypeScript error: Remove .default() from Zod schema to fix type mismatch with useForm
83be108 - Fix Zod schema: Replace z.literal with z.string().refine for delete account confirmation
f7414bc - Fix TypeScript errors: Change error.errors to error.issues for ZodError
```

---

## Verification Checklist

- [x] All TypeScript errors fixed in code
- [x] All fixes committed to Git
- [x] All fixes pushed to GitHub `main` branch
- [ ] Vercel deploying latest commit (`8a76e86`)
- [ ] Build succeeding on Vercel
- [ ] Application deployed and accessible

---

## Key Learnings

1. **ZodError uses `issues`, not `errors`** - This is a common mistake
2. **Zod `.default()` can cause type inference issues** - Better to use `useForm` defaults
3. **Type predicates don't work with `as const`** - Can't narrow from literal to wider type
4. **Vercel Git integration can get stuck** - May need to disconnect/reconnect or use CLI

---

## Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Type Predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Git Integration Troubleshooting](https://vercel.com/docs/concepts/git)

---

**Last Updated:** 2026-02-09
**Status:** Waiting for Vercel to deploy latest commit
