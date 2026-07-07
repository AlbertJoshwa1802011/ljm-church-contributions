# Cloudflare D1 Database Setup Guide

Follow these simple steps to initialize your D1 SQL database and bind it to your Cloudflare Pages application.

## 1. Create the D1 Database via Cloudflare Dashboard
1. Go to your **Cloudflare Dashboard** ➡️ **Workers & Pages** ➡️ **D1**.
2. Click **Create database** ➡️ **Dashboard**.
3. Name your database: `ljm-contributions-db`.
4. Click **Create**.

---

## 2. Bind the Database to Cloudflare Pages
1. Go to your Pages application in the **Workers & Pages** dashboard.
2. Select your project ➡️ **Settings** ➡️ **Functions**.
3. Scroll down to **D1 database bindings**.
4. Click **Add binding**.
5. Set:
   * **Variable name**: `DB` (This must match the variable name used in the serverless API functions).
   * **D1 database**: Select `ljm-contributions-db` from the dropdown.
6. Click **Save**.
7. *Repeat this step for both "Production" and "Preview" environments.*

---

## 3. Apply the SQL Schema (First Deployment)
Once your database is created, you can initialize the tables using the `schema.sql` file via Wrangler.

Run the following command in your terminal to initialize the tables on the live database:
```bash
npx wrangler d1 execute ljm-contributions-db --remote --file=./schema.sql
```

## 4. Local Development (Optional)
If you are running the project locally using Wrangler pages dev, Wrangler will automatically create a local D1 SQLite file. Run:
```bash
npx wrangler pages dev . --d1 DB=ljm-contributions-db
```
Inside the local app, Wrangler will run the database migrations automatically or prompt you to run them.
