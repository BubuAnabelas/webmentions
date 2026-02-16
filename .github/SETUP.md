# GitHub Actions + Cloudflare Setup

This repository uses GitHub Actions to build, test, publish, and deploy the webmentions monorepo.

## Workflows

### CI (`ci.yml`)
- **Trigger**: Push or PR to `main` branch (only runs when relevant paths change)
- **Purpose**: Build and test both packages
- **Steps**:
  1. Build `webmentions-handler-drizzle` package
  2. Run tests for `webmentions-handler-drizzle`
  3. Run tests for `cloudflare-workers-openapi`
  4. Lint and type-check the Worker

### Deploy (`deploy.yml`)
- **Trigger**: Push to `main` branch (only runs when relevant paths change)
- **Purpose**: Deploy Cloudflare Worker and Dashboard to staging, then production
- **Environments**:
  - **Staging**: `webmentions-worker-staging` and `webmentions-dashboard-staging` with shared `webmentions-staging` D1 database
  - **Production**: `webmentions-worker` and dashboard (if configured) with `webmentions` D1 database
- **Steps** (staging):
  1. Build dependencies, run tests
  2. Apply D1 migrations to `webmentions-staging` (worker)
  3. Deploy Worker to staging
  4. Deploy Dashboard to staging (same D1 binding)

### Publish (`publish.yml`)
- **Trigger**: Git tags matching `webmentions-handler-drizzle-v*` or `v*`
- **Purpose**: Publish `webmentions-handler-drizzle` package to npm
- **Steps**:
  1. Build the package
  2. Run tests
  3. Publish to npm registry

## Required Secrets

Configure these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

### Cloudflare (for deploy workflow)
- `CLOUDFLARE_API_TOKEN`: API token with Workers edit and D1 permissions
  - Create at: Cloudflare Dashboard → My Profile → API Tokens
  - Use the "Edit Cloudflare Workers" template or create a custom token with:
    - Account.Cloudflare Workers Scripts: Edit
    - Account.D1: Edit
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
  - Find at: Cloudflare Dashboard → Workers & Pages → Overview (right sidebar)

### npm (for publish workflow)
- `NPM_AUTH_TOKEN`: npm access token with publish permissions
  - Create at: npmjs.com → Access Tokens → Generate New Token
  - Select "Automation" type for CI/CD usage

## Required Setup Steps

### 1. Create Staging D1 Database

The production database is already configured in `wrangler.toml`. You need to create a staging database:

```bash
cd cloudflare-workers-openapi
wrangler d1 create webmentions-staging
```

Copy the `database_id` from the output and replace `STAGING_DATABASE_ID_PLACEHOLDER` in **both**:

1. **cloudflare-workers-openapi/wrangler.toml** (env.staging.d1_databases)
2. **webmentions-dashboard/wrangler.toml** (env.staging.d1_databases)

So the worker and dashboard share the same staging D1 database.

### 2. Apply Initial Migrations

For both databases, apply the initial schema:

```bash
# Staging
wrangler d1 migrations apply webmentions-staging --env staging --remote

# Production
wrangler d1 migrations apply webmentions --remote
```

### 3. Configure GitHub Environments (Optional but Recommended)

For deployment protection and approval gates:

1. Go to: Repository Settings → Environments
2. Create `staging` and `production` environments
3. For `production`, enable:
   - Required reviewers (approve deployments before they run)
   - Wait timer (optional delay before deployment)
   - Deployment branches (restrict to `main` only)

### 4. Test the Workflows

1. **Test CI**: Create a branch, make a change, and open a PR
2. **Test Deploy**: Merge to `main` (or push directly) to trigger staging → production deploy
3. **Test Publish**: Create and push a git tag:
   ```bash
   git tag webmentions-handler-drizzle-v0.1.1
   git push origin webmentions-handler-drizzle-v0.1.1
   ```

## Local Development

### Run migrations locally

```bash
cd cloudflare-workers-openapi

# Create local D1 database
wrangler d1 migrations apply webmentions --local

# Or for staging
wrangler d1 migrations apply webmentions-staging --env staging --local
```

### Test the Worker locally

```bash
cd cloudflare-workers-openapi
pnpm run dev
```

### Generate new migrations

When you update the schema in `src/schema.ts`:

```bash
cd cloudflare-workers-openapi
pnpm exec drizzle-kit generate
```

This creates a new migration file in `migrations/` directory.

## Path Filters

Workflows only run when relevant files change:

- **CI**: Runs on changes to worker, drizzle package, workspace config
- **Deploy**: Runs on changes to worker or drizzle package
- **Publish**: Only runs on git tags (no path filter)

## Troubleshooting

### "Database not found" error
- Verify `database_id` in `wrangler.toml` matches your Cloudflare D1 database
- Check that secrets are configured in GitHub

### "Migration already applied" error
- Migrations are tracked in the `d1_migrations` table
- Safe to ignore if the schema is already up to date

### npm publish fails
- Verify `NPM_AUTH_TOKEN` secret is set
- Check package version in `package.json` hasn't been published yet
- Ensure npm token has publish access to `webmentions-handler-drizzle`

### Worker deploy fails
- Check `CLOUDFLARE_API_TOKEN` has Workers edit permission
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Ensure wrangler.toml has correct database IDs
