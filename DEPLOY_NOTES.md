# Migraflow CRM: deployment and recovery notes

## Where the project lives

- GitHub repository: https://github.com/reziflow-code/migraflow
- Production site: https://reziflow.vercel.app
- Local project folder:
  `C:\Users\verbe\Documents\Codex\2026-05-02\files-mentioned-by-the-user-migraflow\migraflow-main`

## What is stored where

- GitHub stores the application code.
- Vercel hosts the live website and stores production environment variables.
- Supabase/PostgreSQL stores the database.
- The local `.env` file stores secrets for local development only.

Never commit `.env`, database passwords, JWT secrets, or uploaded client documents to GitHub.

## Environment variables

The local `.env` file is here:

```text
C:\Users\verbe\Documents\Codex\2026-05-02\files-mentioned-by-the-user-migraflow\migraflow-main\.env
```

Save a backup copy of this file in a safe place, for example:

- a password manager;
- encrypted archive on Google Drive / OneDrive;
- encrypted USB drive.

The Vercel environment variables are in:

```text
Vercel -> project reziflow -> Settings -> Environment Variables
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
git clone https://github.com/reziflow-code/migraflow.git
cd migraflow
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

## Important warning about documents

Client documents should not be stored only on a local computer. For production use, store uploaded files in Cloudinary or Supabase Storage.

If Cloudinary variables are missing, the app can fall back to local uploads, but this is not reliable for production.
 
