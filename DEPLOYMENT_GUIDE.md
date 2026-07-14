# Phase 1 Production Deployment Guide

## Overview
This guide walks through deploying Phase 1 (complete admin console redesign, families, Bible verses, wishlist images) to production Cloudflare D1.

**Status**: All code is merged to `main` and ready. Just need to apply migrations.

---

## Prerequisites
✅ Phase 1 code merged to main  
✅ All 33 tests passing  
✅ Cloudflare API Token configured in GitHub Secrets  
✅ D1 database binding active on Cloudflare Pages  

---

## Step 1: Verify GitHub Secrets Are Set

Go to: `Settings → Secrets and variables → Actions`

Required secrets:
- `CLOUDFLARE_API_TOKEN` — Your Cloudflare API token with D1 write permissions
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare Account ID

If not set, create them:
1. Get token from: https://dash.cloudflare.com/profile/api-tokens
2. Get account ID from: https://dash.cloudflare.com/

---

## Step 2: Apply Migrations (In Order)

### Option A: GitHub Actions (Recommended) ✅

Go to: `.github/workflows/deploy-migrations.yml`

Run manually for each migration in sequence:

1. **Migration 0005**: Purchase Attribution
   - GitHub Actions → "Deploy Migrations to Production D1"
   - Select: `0005_purchase_attribution`
   - Click "Run workflow"
   - ⏳ Wait for completion (~1-2 min)

2. **Migration 0006**: Families
   - Select: `0006_families`
   - Run

3. **Migration 0007**: Sandha/Family
   - Select: `0007_sandha_family`
   - Run

4. **Migration 0008**: Bible Verses Tables
   - Select: `0008_bible_verses`
   - Run

5. **Migration 0009**: KJV Seed Data
   - Select: `0009_bible_kjv_seed`
   - Run

6. **Migration 0010**: Wishlist Images
   - Select: `0010_wishlist_images`
   - Run

### Option B: Manual CLI (Requires Wrangler + API Token)

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Run in order:
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0005_purchase_attribution.sql
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0006_families.sql
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0007_sandha_family.sql
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0008_bible_verses.sql
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0009_bible_kjv_seed.sql
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0010_wishlist_images.sql
```

---

## Step 3: Verify Migrations Applied

### Check Cloudflare Dashboard
1. Go to: https://dash.cloudflare.com/ → Workers & Pages → D1
2. Click `ljm-contributions-db`
3. Run query to verify tables:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
   ```

### Run Admin Self-Test
1. Sign in to: `https://your-site.pages.dev/admin.html`
2. Click: Admin → Self-Test
3. Should show: **✅ 33/33 tests passing**

### Verify Data
Check that:
- ✅ Members list populates
- ✅ Funds display correctly
- ✅ Bible verses are searchable
- ✅ Wishlist loads (with images if added)
- ✅ Admin operations work (create fund, add member, etc.)

---

## Step 4: Smoke Test Public Site

Visit: `https://your-site.pages.dev/`

Verify:
- ✅ Home page loads with theme
- ✅ Dashboard tabs sticky (Overview/Contributors/Analytics)
- ✅ KPI cards display (Collected, Spent, Balance, etc.)
- ✅ Wishlist section shows with images
- ✅ Mobile menu works (More sheet, drag-to-close)
- ✅ About page displays
- ✅ Members page works

---

## Step 5: Post-Deployment

### Enable Admin Features
In admin.html Settings:

1. **Family Grouping**
   - Go to Admin → People → Families
   - Group existing members into families
   - Test per-family Subscriptions billing

2. **Bible Verse**
   - Go to Admin → Content → Verses
   - Verify KJV verses are searchable
   - Try importing additional verses (if needed)

3. **Wishlist Images**
   - Go to Admin → Content → Wishlist
   - Test adding an item with an image
   - Verify thumbnail shows on public site

### Monitor Logs
Watch for 24 hours:
- Cloudflare Pages logs
- D1 query errors
- User feedback on new features

---

## Rollback (If Issues)

If something goes wrong, you can:

1. **Revert code** (if needed):
   ```bash
   git revert <merge-commit-sha>
   git push origin main
   ```

2. **Restore D1 Database** (via Cloudflare):
   - Use database backups if available
   - Or restore from before migrations

3. **Post-incident review**:
   - Check logs for errors
   - Fix in development
   - Re-test before attempting deployment again

---

## Troubleshooting

### "Migration fails with SQL error"
- Check migration file syntax
- Verify table/column names match schema.sql
- Run locally first: `npx wrangler d1 execute ljm-contributions-db --local --file=...`

### "Self-test shows failures"
- Run tests locally: `npm test`
- Check logs for specific failures
- Rollback migration if needed

### "Data not showing in admin"
- Verify migration ran successfully
- Check that tables exist: `SELECT * FROM sqlite_master WHERE type='table';`
- Verify API endpoints return data: `GET /api/families`, `/api/bible`, etc.

### "Wishlist images don't display"
- Check migration 0010 applied
- Verify image_url column exists: `PRAGMA table_info(wishlist);`
- Test image upload in admin console

---

## Timeline

| Step | Time | Status |
|------|------|--------|
| Apply migrations (6 total) | 10-15 min | Ready |
| Verify migrations applied | 5 min | Ready |
| Run admin self-test | 2 min | Ready |
| Smoke test public site | 10 min | Ready |
| Monitor production | 24 hrs | Ready |

**Total deployment time**: ~30-45 minutes

---

## After Deployment ✅

Once migrations are applied and verified:

1. ✅ Phase 1 is live on production
2. ✅ All features available to users
3. ✅ Admin can manage families, Bible verses, wishlist with images
4. ✅ Ready to start Phase 2 (Welcome/Login page)

---

## Questions?

If anything fails or seems wrong:
1. Check Cloudflare dashboard logs
2. Run `npm test` locally to verify code
3. Review migration files for syntax
4. Contact Cloudflare support if database is down

---

**Generated**: 2026-07-14  
**Phase**: 1 Deployment  
**Status**: Ready to deploy ✅
