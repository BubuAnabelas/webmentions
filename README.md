# Webmentions

Self-hosted [Webmention](https://www.w3.org/TR/webmention/) receiver and admin dashboard, built on Cloudflare Workers + D1.

- [`cloudflare-workers-openapi`](cloudflare-workers-openapi) — the webmention endpoint (OpenAPI, D1, scheduled verification cron)
- [`webmentions-dashboard`](webmentions-dashboard) — admin UI for domains, block rules, and settings
- [`webmentions-handler-drizzle`](webmentions-handler-drizzle) — shared Drizzle storage/validation library

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BubuAnabelas/webmentions/tree/main/cloudflare-workers-openapi)

Deploys the webmention API worker with its own D1 database (migrations applied automatically, no secrets required). See [`cloudflare-workers-openapi/README.md`](cloudflare-workers-openapi/README.md) for how to also deploy the admin dashboard against the same database.
