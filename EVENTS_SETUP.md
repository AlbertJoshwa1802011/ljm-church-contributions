# Events Feature Setup Guide

Follow these steps to enable R2-backed photo storage for the Events feature and
to apply the database migration that creates the `events` and `event_photos`
tables.

---

## 1. Create the R2 Bucket via Cloudflare Dashboard
1. Go to your **Cloudflare Dashboard** ➡️ **R2 Object Storage**.
2. Click **Create bucket**.
3. Name the bucket: `ljm-event-photos`.
4. Leave the default location/settings and click **Create bucket**.

---

## 2. Bind the Bucket to Cloudflare Pages
1. Go to your Pages application in the **Workers & Pages** dashboard.
2. Select your project ➡️ **Settings** ➡️ **Functions**.
3. Scroll down to **R2 bucket bindings**.
4. Click **Add binding** and set:
   * **Variable name**: `EVENT_PHOTOS` (must match the binding name used in `functions/api/events.js`).
   * **R2 bucket**: Select `ljm-event-photos` from the dropdown.
5. Click **Save**.
6. *Repeat this step for both "Production" and "Preview" environments* — bindings
   are per-environment and won't carry over automatically.

`wrangler.jsonc` already declares this binding for local `wrangler pages dev` runs:
```jsonc
"r2_buckets": [
  { "binding": "EVENT_PHOTOS", "bucket_name": "ljm-event-photos" }
]
```

---

## 3. Apply the `events` Migration
Once the bucket is created (binding can be added before or after), apply
migration `0011_events.sql` to create the `events` and `event_photos` tables
and grant the new `manage_events` permission to `super_admin`.

Preferred: run the **"Deploy Migrations to Production D1"** GitHub Actions
workflow —
1. Go to the repo's **Actions** tab ➡️ **Deploy Migrations to Production D1** ➡️ **Run workflow**.
2. Choose `0011_events` from the migration dropdown.
3. Click **Run workflow**.

Alternatively, apply it directly with Wrangler:
```bash
npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0011_events.sql
```

---

## 4. Fallback Behavior (No R2 Bound Yet)
If the `EVENT_PHOTOS` binding is not configured, `functions/api/events.js`
automatically falls back to storing uploaded photos as base64 data URLs
directly in the `events` / `event_photos` D1 tables. Everything continues to
work end-to-end without R2 — you can bind the bucket later at any time to
switch new uploads over to R2-backed storage without any code changes.
