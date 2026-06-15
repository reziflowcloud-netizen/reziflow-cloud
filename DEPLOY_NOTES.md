# LegalHub CRM: deployment and recovery notes

## Where the project lives

- GitHub repository: https://github.com/reziflowcloud-netizen/reziflow-cloud
- Production site: https://legalhubcrm.com
- Current local project folder:
  `C:\Users\verbe\Documents\Codex\2026-05-18\files-mentioned-by-the-user-reziflow\reziflow-cloud-github`
- Integration sandbox used for the landing + CRM merge:
  `C:\Users\verbe\Documents\Codex\2026-06-15\legalhub-crm-crm-c-users-verbe\work\legalhub-integration`
- Old CRM reference folder:
  `C:\Users\verbe\Documents\Codex\2026-05-02\files-mentioned-by-the-user-migraflow\migraflow-main`

## What is stored where

- GitHub stores the application code.
- Vercel hosts the live website and stores production environment variables.
- PostgreSQL stores the database. Production currently uses the database configured in Vercel environment variables.
- The local `.env` file stores secrets for local development only.

Never commit `.env`, database passwords, JWT secrets, or uploaded client documents to GitHub.

## Environment variables

The current landing/CRM repository may not have a local `.env` file. Production secrets are stored in Vercel.

The old CRM reference folder has a local `.env` here:

```text
C:\Users\verbe\Documents\Codex\2026-05-02\files-mentioned-by-the-user-migraflow\migraflow-main\.env
```

Save a backup copy of this file in a safe place, for example:

- a password manager;
- encrypted archive on Google Drive / OneDrive;
- encrypted USB drive.

The Vercel environment variables are in:

```text
Vercel -> LegalHub CRM project -> Settings -> Environment Variables
```

Important variables:

```text
DATABASE_URL
DIRECT_URL
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_NAME
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_UPLOAD_PRESET
```

`DATABASE_URL` is used by the application.

`DIRECT_URL` is used for database migrations. If it is not set, deployment still works, but automatic migrations are skipped.

## Restore project after reinstalling Windows

1. Install Node.js.
2. Install Git.
3. Download the project:

```bash
git clone https://github.com/reziflowcloud-netizen/reziflow-cloud.git
cd reziflow-cloud
```

4. Restore `.env` from your backup into the project folder.
5. Install dependencies:

```bash
npm install
```

6. Run the project locally:

```bash
npm run dev
```

7. Open:

```text
http://127.0.0.1:3000
```

## Normal update workflow

1. Make code changes locally.
2. Test locally:

```bash
npm run build
```

3. Commit changes:

```bash
git add .
git commit -m "Describe the change"
```

4. Push to GitHub:

```bash
git push
```

5. Vercel automatically deploys the new version.

## Database migrations

The build command runs:

```bash
node scripts/vercel-migrate.js && prisma generate && next build
```

If `DIRECT_URL` exists, migrations are applied automatically.

If `DIRECT_URL` is missing, migrations are skipped and deployment continues.

## Post-release cleanup checklist

After testing registration on production:

1. Remove or clearly mark any test organizations created on `https://legalhubcrm.com`.
2. If a temporary Neon/PostgreSQL test database was used, reset its role password after testing.
3. Confirm `https://legalhubcrm.com/register?plan=free` loads and creates organizations correctly.
4. Confirm unauthenticated `https://legalhubcrm.com/dashboard` redirects to `/login`.
5. Keep `.env`, `.env.local`, database URLs, JWT secrets, and service tokens out of Git.

## Test database note

For local end-to-end tests, use a separate empty PostgreSQL database, not production. The tested flow is:

```text
landing -> /register -> /api/auth/register -> auth-token cookie -> /dashboard
```

## Important warning about documents

Client documents should not be stored only on a local computer. For production use, store uploaded files in Cloudinary or Supabase Storage.

If Cloudinary variables are missing, the app can fall back to local uploads, but this is not reliable for production.
 
